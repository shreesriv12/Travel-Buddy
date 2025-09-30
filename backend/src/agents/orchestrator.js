import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { weatherAgent } from "./weatherAgent.js";
// Import other agents as you create them:
// import { mapsAgent } from "./mapsAgent.js";
// import { budgetAgent } from "./budgetAgent.js";
// import { itineraryAgent } from "./itineraryAgent.js";
// import { eventsAgent } from "./eventsAgent.js";



// Register all your agents here
const TOOL_REGISTRY = {
  [weatherAgent.name]: weatherAgent,
  // [mapsAgent.name]: mapsAgent,
  // [budgetAgent.name]: budgetAgent,
  // [itineraryAgent.name]: itineraryAgent,
  // [eventsAgent.name]: eventsAgent,
};




// Convert registry to an array for LLM prompts
const TOOL_LIST_FOR_PROMPT = Object.values(TOOL_REGISTRY).map((t) => ({
  name: t.name,
  description: t.description,
  parameters: t.jsonSchema,
}));





function createLLM() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");

  return new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.0-flash",
    temperature: 0.2,
  });
}




const SYSTEM_PROMPT = `
You are the Orchestrator for TravelBuddy. You coordinate multiple specialized agents to plan trips.

Available agents:
- weatherTool: Fetches weather forecasts
- mapsTool: Gets location data and routes (coming soon)
- budgetTool: Calculates trip costs (coming soon)
- itineraryTool: Creates day-by-day plans (coming soon)
- eventsTool: Finds local events and attractions (coming soon)

STRICT OUTPUT FORMAT:
Return ONLY a single JSON object with one of these shapes:

1) Call a tool
{
  "action": "call_tool",
  "tool": "<tool name>",
  "arguments": { ...valid JSON per tool schema... },
  "reasoning": "<brief rationale>"
}

2) Finish with a final answer
{
  "action": "final",
  "answer": "<concise final summary or user-facing message>"
}

Rules:
- Do not include any extra keys outside the specified shapes.
- Do not wrap JSON in markdown.
- Call tools in a logical order (e.g., weather before itinerary).
- Only call a tool if it adds value to the trip planning.
- Provide a helpful final answer summarizing what was accomplished.
`;




function buildUserPrompt(trip, previousToolResults = []) {
  return `
Trip Context:
${JSON.stringify(
  {
    id: trip.id,
    destination: trip.destination,
    coords: trip.destination_coords,
    dates: { start: trip.start_date, end: trip.end_date },
  },
  null,
  2
)}




Available Tools:
${JSON.stringify(TOOL_LIST_FOR_PROMPT, null, 2)}

Previous Tool Results:
${previousToolResults.length === 0 
  ? "None yet" 
  : JSON.stringify(previousToolResults.map(r => ({
      tool: r.tool,
      summary: r.resultSummary
    })), null, 2)
}

Decide what to do next. Consider the trip context and what tools haven't been called yet.
`;
}


function safeParseJSON(maybeJSON) {
  if (!maybeJSON) return null;
  try {
    return JSON.parse(maybeJSON);
  } catch {}
  // Try extracting from markdown code blocks
  const match = String(maybeJSON).match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {}
  }
  return null;
}


export async function runMCPOrchestrator(trip, { maxSteps = 6 } = {}) {
  // Validate input
  if (!trip?.id || !trip?.destination_coords) {
    throw new Error(
      "Trip object must include id and destination_coords {lat, lng}"
    );
  }
  const { lat, lng } = trip.destination_coords;
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("destination_coords must contain numeric lat and lng");
  }

  const llm = createLLM();
  const previousToolResults = [];
  const messages = [new SystemMessage(SYSTEM_PROMPT)];

  for (let step = 1; step <= maxSteps; step++) {
    console.log(`\n[Orchestrator] Step ${step}/${maxSteps}`);
    
    const userPrompt = buildUserPrompt(trip, previousToolResults);
    const aiMsg = await llm.invoke([...messages, new HumanMessage(userPrompt)]);

    const text =
      typeof aiMsg?.content === "string"
        ? aiMsg.content
        : Array.isArray(aiMsg?.content)
        ? aiMsg.content.map((c) => (typeof c === "string" ? c : c?.text || "")).join("\n")
        : String(aiMsg ?? "");

    console.log(`[Orchestrator] LLM Response:`, text.substring(0, 200));

    const parsed = safeParseJSON(text);

    if (!parsed || !parsed.action) {
      console.warn(`[Orchestrator] Invalid JSON format`);
      messages.push(
        new AIMessage(text),
        new HumanMessage(
          "FORMAT_ERROR: Your previous response was not valid JSON per the schema. Reply again with ONLY the JSON object."
        )
      );
      if (step === maxSteps) {
        return {
          status: "ERROR",
          message: "Max steps reached with invalid LLM formatting.",
          lastLLM: text,
        };
      }
      continue;
    }

    if (parsed.action === "final") {
      console.log(`[Orchestrator] ✓ Finished successfully`);
      return {
        status: "SUCCESS",
        stepCount: step,
        answer: parsed.answer || "Trip planning completed.",
        toolResults: previousToolResults,
      };
    }

    if (parsed.action === "call_tool") {
      const toolName = parsed.tool;
      const tool = TOOL_REGISTRY[toolName];
      
      console.log(`[Orchestrator] Calling tool: ${toolName}`);

      if (!tool) {
        console.warn(`[Orchestrator] Unknown tool: ${toolName}`);
        messages.push(
          new AIMessage(text),
          new HumanMessage(`TOOL_ERROR: Unknown tool "${toolName}". Available tools: ${Object.keys(TOOL_REGISTRY).join(", ")}`)
        );
        if (step === maxSteps) {
          return {
            status: "ERROR",
            message: `Unknown tool requested at final step: ${toolName}`,
          };
        }
        continue;
      }

      let args;
      try {
        args = tool.validate(parsed.arguments);
      } catch (e) {
        console.warn(`[Orchestrator] Invalid arguments for ${toolName}:`, e.message);
        messages.push(
          new AIMessage(text),
          new HumanMessage(
            `ARG_ERROR: ${e.message}. Re-try with valid arguments per schema.`
          )
        );
        if (step === maxSteps) {
          return {
            status: "ERROR",
            message: `Invalid tool arguments at final step: ${e.message}`,
          };
        }
        continue;
      }

      try {
        const result = await tool.execute(args);
        console.log(`[Orchestrator] ✓ ${toolName} completed:`, result.summary);
        
        const toolRecord = {
          step,
          tool: toolName,
          args,
          resultSummary: result?.summary || null,
          result,
        };
        previousToolResults.push(toolRecord);

        // Add messages to conversation
        messages.push(
          new AIMessage(text),
          new ToolMessage({
            content: JSON.stringify({
              summary: result.summary,
              data: result.raw ? "Available in database" : null,
            }),
            tool_call_id: `${toolName}_${step}`,
            name: toolName,
          })
        );

        continue;
      } catch (e) {
        console.error(`[Orchestrator] Tool execution error:`, e.message);
        messages.push(
          new AIMessage(text),
          new HumanMessage(
            `TOOL_RUNTIME_ERROR: ${e.message}. Consider alternative action or finishing.`
          )
        );
        if (step === maxSteps) {
          return {
            status: "ERROR",
            message: `Tool runtime error at final step: ${e.message}`,
          };
        }
        continue;
      }
    }

    console.warn(`[Orchestrator] Unknown action: ${parsed.action}`);
    messages.push(
      new AIMessage(text),
      new HumanMessage(
        'ACTION_ERROR: Unknown "action". Use "call_tool" or "final" only.'
      )
    );
  }

  console.log(`[Orchestrator] Max steps reached without finalization`);
  return {
    status: "PARTIAL",
    message: "Max steps reached without finalization. Returning accumulated results.",
    toolResults: previousToolResults,
  };
}