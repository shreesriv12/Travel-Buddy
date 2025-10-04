// --------------------
// Imports
// --------------------
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { weatherAgent } from "./weatherAgent.js";
import { budgetAgent } from "./budgetAgent.js";
import { eventsAgent } from "./eventsAgent.js";
import { itineraryAgent } from "./itineraryAgent.js";
import { mapsAgent } from "./mapsAgent.js";
import prisma from "../config/db.js";

// --------------------
// Tool Registry
// --------------------
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

// --------------------
// System Prompt
// --------------------
const SYSTEM_PROMPT = `
You are the TravelBuddy Orchestrator. You coordinate multiple specialized agents to plan comprehensive trips.

Available Agents:
${TOOL_LIST_FOR_PROMPT.map(t => `- ${t.name}: ${t.description}`).join("\n")}

Execution Rules:
1. Weather agent MUST be called first to get forecast data
2. Budget agent MUST be called second to get flight/hotel costs
3. Events agent MUST be called third to discover local activities
4. Itinerary agent MUST be called fourth (uses weather, budget, and events data)
5. Maps agent MUST be called last for routes between POIs

Response Format:
Always return valid JSON with one of these actions:
{
  "action": "call_tool",
  "tool": "toolName",
  "arguments": { ... },
  "reasoning": "Why this tool is needed now"
}

OR

{
  "action": "final",
  "answer": "Natural language summary of the complete trip plan"
}

CRITICAL: You MUST follow the execution order above. Never skip agents or change the sequence.
`;

// --------------------
// LLM Initialization
// --------------------
function createLLM() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
  
  return new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.0-flash",
    temperature: 0.2,
  });
}

// --------------------
// Build User Prompt
// --------------------
function buildUserPrompt(trip, previousToolResults = []) {
  const tripContext = {
    id: trip.id,
    origin: trip.origin,
    origin_coords: trip.origin_coords,
    destination: trip.destination,
    destination_coords: trip.destination_coords,
    start_date: trip.start_date,
    end_date: trip.end_date,
    adults: trip.adults || 1,
    children: trip.children || 0,
    total_budget: trip.total_budget || 0,
    days: Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)) || 1
  };

  const completedTools = previousToolResults.map(r => r.tool);
  const pendingTools = Object.keys(TOOL_REGISTRY).filter(t => !completedTools.includes(t));

  return `
Trip Details:
${JSON.stringify(tripContext, null, 2)}

Completed Agents:
${previousToolResults.length === 0 ? "None yet" : previousToolResults.map(r => 
  `✓ ${r.tool}: ${r.resultSummary}`
).join("\n")}

Pending Agents:
${pendingTools.length === 0 ? "All agents completed" : pendingTools.join(", ")}

Available Tools:
${JSON.stringify(TOOL_LIST_FOR_PROMPT, null, 2)}

Determine the next action. Follow the execution order: weather → budget → events → itinerary → maps
`;
}

// --------------------
// JSON Parser
// --------------------
function safeParseJSON(text) {
  if (!text) return null;
  
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch {}

  // Extract from code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {}
  }

  // Find JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  return null;
}

// --------------------
// LLM Invoke with Retry
// --------------------
async function safeLLMInvoke(llm, messages, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await llm.invoke(messages);
    } catch (error) {
      if (error.status === 429) {
        const waitSeconds = error.errorDetails?.[2]?.retryDelay?.replace("s", "") || 5;
        console.warn(`[Orchestrator] Rate limited. Retry ${attempt}/${retries} in ${waitSeconds}s...`);
        await new Promise(resolve => setTimeout(resolve, parseFloat(waitSeconds) * 1000));
      } else if (attempt === retries) {
        throw error;
      } else {
        console.warn(`[Orchestrator] LLM error on attempt ${attempt}:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  throw new Error("LLM invocation failed after all retries");
}

// --------------------
// Main Orchestrator
// --------------------
export async function runMCPOrchestrator(trip, { maxSteps = 10 } = {}) {
  console.log("\n=== MCP Orchestrator Started ===");
  console.log(`[Orchestrator] Trip ID: ${trip.id}, Destination: ${trip.destination}`);

  // Validation
  if (!trip?.id || !trip?.destination_coords) {
    throw new Error("Trip must include id and destination_coords");
  }

  const llm = createLLM();
  const previousToolResults = [];
  const messages = [new SystemMessage(SYSTEM_PROMPT)];

  // Agent execution flags
  let weatherDone = false;
  let flightDone = false;
  let budgetDone = false;
  let eventsDone = false;
  let itineraryDone = false;
  let mapsDone = false;

  for (let step = 1; step <= maxSteps; step++) {
    console.log(`\n[Orchestrator] === Step ${step}/${maxSteps} ===`);

    // ============================================
    // 1️⃣ WEATHER AGENT (Always first)
    // ============================================
    if (!weatherDone) {
      console.log("[Orchestrator] Executing weatherAgent...");
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
          resultSummary: result.summary || "Weather data fetched",
          result
        });

        weatherDone = true;
        console.log("[Orchestrator] ✅ weatherAgent completed");
        continue;
      } catch (error) {
        console.error("[Orchestrator] ❌ weatherAgent failed:", error.message);
        weatherDone = true; // Continue anyway
        continue;
      }
    }

    // ============================================
    // 2️⃣ BUDGET AGENT (After weather)
    // ============================================
    if (!budgetDone) {
      console.log("[Orchestrator] Executing budgetAgent...");
      try {
        const result = await budgetAgent.execute({
          tripId: trip.id,
          adults: trip.adults || 1
        });

        previousToolResults.push({
          step,
          tool: budgetAgent.name,
          args: { tripId: trip.id },
          resultSummary: result.summary || "Budget calculated",
          result
        });

        budgetDone = true;
        console.log("[Orchestrator] ✅ budgetAgent completed");
        continue;
      } catch (error) {
        console.error("[Orchestrator] ❌ budgetAgent failed:", error.message);
        budgetDone = true; // Continue anyway
        continue;
      }
    }

    // ============================================
    // 3️⃣ EVENTS AGENT (After budget)
    // ============================================
    if (!eventsDone) {
      console.log("[Orchestrator] Executing eventsAgent...");
      try {
        const result = await eventsAgent.execute({
          tripId: trip.id,
          destination: trip.destination,
          date: trip.start_date?.toISOString().split("T")[0]
        });

        previousToolResults.push({
          step,
          tool: eventsAgent.name,
          args: { tripId: trip.id, destination: trip.destination },
          resultSummary: result.summary || "Events fetched",
          result
        });

        eventsDone = true;
        console.log("[Orchestrator] ✅ eventsAgent completed");
        continue;
      } catch (error) {
        console.warn("[Orchestrator] ⚠️  eventsAgent failed:", error.message);
        eventsDone = true; // Non-critical, continue
        continue;
      }
    }

    // ============================================
    // 4️⃣ ITINERARY AGENT (After weather + budget + events)
    // ============================================
    if (!itineraryDone) {
      console.log("[Orchestrator] Executing itineraryAgent...");
      try {
        const days = Math.ceil(
          (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
        ) || 3;

        const budgetResult = previousToolResults.find(r => r.tool === budgetAgent.name)?.result;

        const result = await itineraryAgent.execute({
          tripId: trip.id,
          destination: trip.destination,
          days,
          startDate: trip.start_date?.toISOString().split("T")[0],
          adults: trip.adults || 1,
          children: trip.children || 0,
          budgetResult
        });

        previousToolResults.push({
          step,
          tool: itineraryAgent.name,
          args: { tripId: trip.id },
          resultSummary: result.summary || "Itinerary generated",
          result
        });

        itineraryDone = true;
        console.log("[Orchestrator] ✅ itineraryAgent completed");
        continue;
      } catch (error) {
        console.error("[Orchestrator] ❌ itineraryAgent failed:", error.message);
        itineraryDone = true; // Continue anyway
        continue;
      }
    }

    // ============================================
    // 5️⃣ MAPS AGENT (After itinerary - routes between POIs)
    // ============================================
    if (!mapsDone) {
      console.log("[Orchestrator] Executing mapsAgent for routes...");
      try {
        // Get itinerary items from DB
        const itineraryItems = await prisma.itineraryItem.findMany({
          where: { trip_id: trip.id },
          orderBy: [{ day_number: "asc" }, { sort_order: "asc" }]
        });

        if (itineraryItems.length > 0) {
          // Generate route from origin to destination
          const routeResult = await mapsAgent.execute({
            tripId: trip.id,
            mode: "driving"
          });

          previousToolResults.push({
            step,
            tool: mapsAgent.name,
            args: { tripId: trip.id, mode: "driving" },
            resultSummary: `Route: ${trip.origin} → ${trip.destination}`,
            result: routeResult
          });

          console.log("[Orchestrator] ✅ mapsAgent completed");
        }

        mapsDone = true;
        continue;
      } catch (error) {
        console.warn("[Orchestrator] ⚠️  mapsAgent failed:", error.message);
        mapsDone = true; // Non-critical, continue
        continue;
      }
    }

    // ============================================
    // 6️⃣ FINAL STEP - Generate Summary with LLM
    // ============================================
    if (weatherDone && budgetDone && eventsDone && itineraryDone && mapsDone) {
      console.log("\n[Orchestrator] All agents completed. Generating final summary...");

      const userPrompt = buildUserPrompt(trip, previousToolResults);
      const finalPrompt = new HumanMessage(
        userPrompt + "\n\nAll agents have completed. Generate a final answer summarizing the trip plan."
      );

      try {
        const aiMsg = await safeLLMInvoke(llm, [...messages, finalPrompt]);
        const text = aiMsg?.content || "";
        const parsed = safeParseJSON(text);

        // Fetch complete itinerary from DB
        const itineraryItems = await prisma.itineraryItem.findMany({
          where: { trip_id: trip.id },
          orderBy: [{ day_number: "asc" }, { sort_order: "asc" }]
        });

        const finalAnswer = parsed?.answer || text || "Trip planning completed successfully.";

        console.log("\n=== Orchestrator Completed Successfully ===");
        return {
          status: "SUCCESS",
          stepCount: step,
          answer: finalAnswer,
          toolResults: previousToolResults,
          itinerary: itineraryItems,
          summary: {
            weatherChecked: weatherDone,
            budgetCalculated: budgetDone,
            eventsFound: eventsDone,
            itineraryGenerated: itineraryDone,
            routesCalculated: mapsDone
          }
        };
      } catch (error) {
        console.error("[Orchestrator] Final summary generation failed:", error.message);
        
        return {
          status: "PARTIAL_SUCCESS",
          stepCount: step,
          answer: "Trip plan generated but summary failed.",
          toolResults: previousToolResults,
          error: error.message
        };
      }
    }

    // ============================================
    // FALLBACK: LLM Decision (if needed)
    // ============================================
    console.log("[Orchestrator] Consulting LLM for next action...");
    const userPrompt = buildUserPrompt(trip, previousToolResults);
    
    try {
      const aiMsg = await safeLLMInvoke(llm, [...messages, new HumanMessage(userPrompt)]);
      const text = aiMsg?.content || "";
      const parsed = safeParseJSON(text);

      if (!parsed || !parsed.action) {
        console.warn("[Orchestrator] Invalid LLM response format");
        messages.push(
          new AIMessage(text),
          new HumanMessage("FORMAT_ERROR: Response must be valid JSON with 'action' field.")
        );
        continue;
      }

      if (parsed.action === "call_tool") {
        const toolName = parsed.tool;
        const tool = TOOL_REGISTRY[toolName];

        if (!tool) {
          console.warn(`[Orchestrator] Unknown tool: ${toolName}`);
          messages.push(
            new AIMessage(text),
            new HumanMessage(`TOOL_ERROR: Tool "${toolName}" does not exist.`)
          );
          continue;
        }

        let args;
        try {
          args = tool.validate(parsed.arguments);
        } catch (error) {
          console.warn(`[Orchestrator] Invalid arguments for ${toolName}:`, error.message);
          messages.push(
            new AIMessage(text),
            new HumanMessage(`ARG_ERROR: ${error.message}`)
          );
          continue;
        }

        try {
          const result = await tool.execute(args);
          previousToolResults.push({
            step,
            tool: toolName,
            args,
            resultSummary: result.summary || "Completed",
            result
          });

          messages.push(
            new AIMessage(text),
            new ToolMessage({
              content: JSON.stringify({ summary: result.summary, status: "success" }),
              tool_call_id: `${toolName}_${step}`,
              name: toolName
            })
          );

          console.log(`[Orchestrator] ✅ ${toolName} completed via LLM decision`);
        } catch (error) {
          console.error(`[Orchestrator] ❌ ${toolName} execution failed:`, error.message);
          messages.push(
            new AIMessage(text),
            new HumanMessage(`TOOL_RUNTIME_ERROR: ${error.message}`)
          );
        }
      }
    } catch (error) {
      console.error("[Orchestrator] LLM consultation failed:", error.message);
      break;
    }
  }

  // Max steps reached
  console.log("\n=== Orchestrator Ended: Max Steps Reached ===");
  return {
    status: "INCOMPLETE",
    message: "Max steps reached without full completion.",
    stepCount: maxSteps,
    toolResults: previousToolResults
  };
}

// --------------------
// Export
// --------------------
export default runMCPOrchestrator;
