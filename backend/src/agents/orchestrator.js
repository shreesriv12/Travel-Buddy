import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { weatherAgent } from "./weatherAgent.js";
import { budgetAgent } from "./budgetAgent.js";
import { eventsAgent } from "./eventsAgent.js";
import { itineraryAgent } from "./itineraryAgent.js";
import { mapsAgent } from "./mapsAgent.js";
import { flightAgent } from "./flightAgent.js"; 
import prisma from "../config/db.js";

const TOOL_REGISTRY = {
  [weatherAgent.name]: weatherAgent,
  [budgetAgent.name]: budgetAgent,
  [eventsAgent.name]: eventsAgent,
  [itineraryAgent.name]: itineraryAgent,
  [mapsAgent.name]: mapsAgent,
  [flightAgent.name]: flightAgent, 
};

const TOOL_LIST_FOR_PROMPT = Object.values(TOOL_REGISTRY).map(t => ({
  name: t.name,
  description: t.description,
  parameters: t.jsonSchema,
}));

const SYSTEM_PROMPT = `
You are the Orchestrator for TravelBuddy. Plan trips by coordinating multiple agents.

Available Tools:

1. weatherAgent
- Description: Fetches weather forecasts for the destination during the trip dates.
- Parameters: tripId, destination, startDate, endDate

2. budgetAgent
- Description: Estimates total trip cost including flights, hotels, food, and local transport.
- Parameters: tripId, adults, children

3. eventsAgent
- Description: Finds local events happening at the destination.
- Parameters: tripId, destination

4. itineraryAgent
- Description: Generates a day-by-day itinerary for the trip, based on weather, budget, and events.
- Parameters: tripId, destination, days, total_budget, budgetResult, adults, children

5. mapsAgent
- Description: Fetches route, travel distance, estimated duration, and estimated cost between two places using Google Maps Directions API.
- Parameters:
  - tripId: string (required)
  - origin: string (required)
  - destination: string (required)
  - mode: string (optional, one of ["driving","transit","walking","bicycling"], default "driving")

6. flightAgent
- Description: Fetches best flight options between origin and destination using city names, IATA codes, or kgmid codes.
- Parameters:
  - origin: string (required) - Origin city name, IATA airport code, or kgmid
  - destination: string (required) - Destination city name, IATA airport code, or kgmid
  - departureDate: string (required) - Outbound date in YYYY-MM-DD
  - returnDate: string (optional) - Return date in YYYY-MM-DD
  - adults: integer (optional, default: 1)
  - children: integer (optional, default: 0)
  - currency: string (optional, default: INR)

Rules:
- ALWAYS call weatherAgent first.
- ALWAYS call flightAgent after weatherAgent to get flight options.
- ALWAYS call budgetAgent after flightAgent to get comprehensive budget.
- You MAY call eventsAgent to add value if events are available.
- ALWAYS call itineraryAgent after budgetAgent.
- ALWAYS call mapsAgent after itineraryAgent.
- Return strictly JSON: either call_tool or final.

call_tool:
{
  "action": "call_tool",
  "tool": "<tool name>",
  "arguments": { ... },
  "reasoning": "<why call this tool>"
}

final:
{
  "action": "final",
  "answer": "<user-facing summary>"
}
`;

function createLLM() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
  return new ChatGoogleGenerativeAI({ apiKey, model: "gemini-2.0-flash", temperature: 0.2 });
}

function buildUserPrompt(trip, previousToolResults = []) {
  return `
Trip Context:
${JSON.stringify({
    id: trip.id,
    origin: trip.origin,
    origin_coords: trip.origin_coords,
    destination: trip.destination,
    destination_coords: trip.destination_coords,
    start_date: trip.start_date,
    end_date: trip.end_date,
    adults: trip.adults || 1,
    children: trip.children || 0,
    total_budget: trip.total_budget || 0
  }, null, 2)}

Available Tools:
${JSON.stringify(TOOL_LIST_FOR_PROMPT, null, 2)}

Previous Tool Results:
${previousToolResults.length === 0 ? "None yet" : previousToolResults.map(r => `${r.tool}: ${r.resultSummary}`).join("\n")}

Decide next action. You MUST call flightAgent after weatherAgent and before budgetAgent.
You MAY call eventsAgent to add value if events are available in that destination.
`;
}

function safeParseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m) {
    try { return JSON.parse(m[1]); } catch {}
  }
  return null;
}

async function safeLLMInvoke(llm, messages, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { return await llm.invoke(messages); } 
    catch (e) {
      if (e.status === 429) {
        const waitTime = e.errorDetails?.[2]?.retryDelay?.replace("s", "") || 5;
        console.warn(`[Orchestrator] Rate limit. Retrying in ${waitTime}s...`);
        await new Promise(r => setTimeout(r, parseFloat(waitTime) * 1000));
      } else throw e;
    }
  }
  throw new Error("LLM invoke failed after retries");
}

// Helper function to format dates for flight agent
function formatDateForFlight(dateString) {
  if (!dateString) return null;
  
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }
  
  if (dateString instanceof Date) {
    return dateString.toISOString().split('T')[0];
  }
  
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch (e) {
    console.error('Date formatting error:', e);
    return null;
  }
}

export async function runMCPOrchestrator(trip, { maxSteps = 8 } = {}) { // Increased maxSteps for flight agent
  if (!trip?.id || !trip?.destination_coords)
    throw new Error("Trip must include id and destination_coords");

  const llm = createLLM();
  const previousToolResults = [];
  const messages = [new SystemMessage(SYSTEM_PROMPT)];

  let weatherDone = false;
  let flightDone = false;
  let budgetDone = false;

  for (let step = 1; step <= maxSteps; step++) {
    console.log(`\n[Orchestrator] Step ${step}/${maxSteps}`);

    // Step 1: Always call weather agent first
    if (!weatherDone) {
      try {
        const result = await weatherAgent.execute({
          tripId: trip.id,
          lat: trip.destination_coords.lat,
          lng: trip.destination_coords.lng,
          destination: trip.destination,
          startDate: trip.start_date?.toISOString(),
          endDate: trip.end_date?.toISOString()
        });
        previousToolResults.push({ 
          step, 
          tool: weatherAgent.name, 
          args: { tripId: trip.id, destination: trip.destination }, 
          resultSummary: result.summary, 
          result 
        });
        weatherDone = true;
        console.log(`[Orchestrator] Weather agent completed`);
        continue;
      } catch (e) {
        console.error(`[Orchestrator] Weather agent failed:`, e.message);
        // Continue to next step even if weather fails
        weatherDone = true;
        continue;
      }
    }

    // Step 2: Always call flight agent after weather
    if (!flightDone) {
      try {
        const departureDate = formatDateForFlight(trip.start_date);
        const returnDate = formatDateForFlight(trip.end_date);
        
        if (!departureDate) {
          throw new Error('Invalid departure date format');
        }

        const result = await flightAgent.execute({
          origin: trip.origin,
          destination: trip.destination,
          departureDate: departureDate,
          returnDate: returnDate,
          adults: trip.adults || 1,
          children: trip.children || 0,
          currency: "INR"
        });
        previousToolResults.push({ 
          step, 
          tool: flightAgent.name, 
          args: { 
            origin: trip.origin, 
            destination: trip.destination,
            departureDate: departureDate,
            returnDate: returnDate
          }, 
          resultSummary: result.summary, 
          result 
        });
        flightDone = true;
        console.log(`[Orchestrator] Flight agent completed`);
        continue;
      } catch (e) {
        console.error(`[Orchestrator] Flight agent failed:`, e.message);
        // Continue to next step even if flights fail
        flightDone = true;
        continue;
      }
    }

    // Step 3: Always call budget agent after flights
    if (!budgetDone) {
      try {
        const result = await budgetAgent.execute({
          tripId: trip.id,
          adults: trip.adults || 1,
          children: trip.children || 0
        });
        previousToolResults.push({ 
          step, 
          tool: budgetAgent.name, 
          args: { tripId: trip.id }, 
          resultSummary: result.summary, 
          result 
        });
        budgetDone = true;
        console.log(`[Orchestrator] Budget agent completed`);
        continue;
      } catch (e) {
        console.error(`[Orchestrator] Budget agent failed:`, e.message);
        // Continue to next step even if budget fails
        budgetDone = true;
        continue;
      }
    }

    // Step 4+: Let LLM decide next actions (events, itinerary, maps)
    const userPrompt = buildUserPrompt(trip, previousToolResults);
    const aiMsg = await safeLLMInvoke(llm, [...messages, new HumanMessage(userPrompt)]);
    const text = aiMsg?.content || "";
    console.log(`[Orchestrator] LLM Response:`, text.substring(0, 300));
    
    const parsed = safeParseJSON(text);

    if (!parsed || !parsed.action) {
      messages.push(new AIMessage(text), new HumanMessage("FORMAT_ERROR: Response not valid JSON. Reply with only the JSON object."));
      continue;
    }

    if (parsed.action === "final") {
      // Fetch itinerary items
      const itineraryItems = await prisma.itineraryItem.findMany({
        where: { trip_id: trip.id },
        orderBy: [{ day_number: "asc" }, { sort_order: "asc" }]
      });

      // Generate routes between itinerary places using mapsAgent
      for (const day of itineraryItems) {
        const places = day.places || [];
        day.routes = [];
        for (let i = 0; i < places.length - 1; i++) {
          const origin = places[i].name;
          const destination = places[i + 1].name;
          try {
            const routeResult = await mapsAgent.execute({ tripId: trip.id, origin, destination, mode: "walking" });
            previousToolResults.push({ 
              step: step + 0.1, 
              tool: mapsAgent.name, 
              args: { tripId: trip.id, origin, destination }, 
              resultSummary: `Route from ${origin} to ${destination}`, 
              result: routeResult 
            });
            day.routes.push(routeResult);
          } catch (e) {
            console.warn(`[Orchestrator] mapsAgent failed for ${origin} -> ${destination}: ${e.message}`);
          }
        }
      }

      return { 
        status: "SUCCESS", 
        stepCount: step, 
        answer: parsed.answer || "Trip planning completed.", 
        toolResults: previousToolResults, 
        itinerary: itineraryItems 
      };
    }

    if (parsed.action === "call_tool") {
      const toolName = parsed.tool;
      const tool = TOOL_REGISTRY[toolName];
      if (!tool) { 
        messages.push(new AIMessage(text), new HumanMessage(`TOOL_ERROR: Unknown tool "${toolName}"`)); 
        continue; 
      }

      let args;
      try { 
        args = tool.validate(parsed.arguments); 
        console.log(`[Orchestrator] Calling ${toolName} with args:`, args);
      } catch (e) { 
        messages.push(new AIMessage(text), new HumanMessage(`ARG_ERROR: ${e.message}`)); 
        continue; 
      }

      try {
        const result = await tool.execute(args);
        previousToolResults.push({ 
          step, 
          tool: toolName, 
          args, 
          resultSummary: result.summary, 
          result 
        });
        messages.push(
          new AIMessage(text), 
          new ToolMessage({ 
            content: JSON.stringify({ 
              summary: result.summary, 
              data: result.raw ? "Available in DB" : null 
            }), 
            tool_call_id: `${toolName}_${step}`, 
            name: toolName 
          })
        );
        console.log(`[Orchestrator] ${toolName} executed successfully`);
      } catch (e) { 
        console.error(`[Orchestrator] ${toolName} execution failed:`, e);
        messages.push(new AIMessage(text), new HumanMessage(`TOOL_RUNTIME_ERROR: ${e.message}`)); 
      }
    }
  }

  return { 
    status: "PARTIAL", 
    message: "Max steps reached without finalization.", 
    toolResults: previousToolResults 
  };
}