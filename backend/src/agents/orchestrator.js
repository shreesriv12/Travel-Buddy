import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { mapsAgent } from "./mapsAgent.js";

import { weatherAgent } from "./weatherAgent.js";
import { mapsAgent } from "./mapsAgent.js";
import { budgetAgent } from "./budgetAgent.js";

// --------------------
// Register agents
// --------------------
const TOOL_REGISTRY = {
  [weatherAgent.name]: weatherAgent,
  [mapsAgent.name]: mapsAgent,
  [budgetAgent.name]: budgetAgent,
};

const TOOL_LIST_FOR_PROMPT = Object.values(TOOL_REGISTRY).map((t) => ({
  name: t.name,
  description: t.description,
  parameters: t.jsonSchema,
}));

// --------------------
// Create LLM
// --------------------
function createLLM() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");

  return new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.0-flash",
    temperature: 0.2,
  });
}

// --------------------
// System prompt
// --------------------
const SYSTEM_PROMPT = `
You are the Orchestrator for TravelBuddy. Coordinate agents to plan trips.
Use all available info from Trip Context and Tools schema.

Available agents:
- weatherTool: Fetch weather forecasts.
- mapsTool: Calculate distance, routes, and travel time.
- budgetTool: Fetch flight/hotel estimates.

STRICT OUTPUT FORMAT:
Return ONLY a single JSON object:
1) Call a tool
{
  "action": "call_tool",
  "tool": "<tool name>",
  "arguments": { ... },
  "reasoning": "<brief rationale>"
}
2) Final answer
{
  "action": "final",
  "answer": "<user-facing summary>"
}
`;

// --------------------
// Build user prompt (lightweight)
// --------------------
function buildUserPrompt(trip, previousToolResults = []) {
  return `
Trip Context:
${JSON.stringify({
    id: trip.id,
    origin: trip.origin,
    origin_coords: trip.origin_coords,
    destination: trip.destination,
    destination_coords: trip.destination_coords,
    dates: { start: trip.start_date, end: trip.end_date },
    adults: trip.adults || 1,
  }, null, 2)}

Available Tools:
${JSON.stringify(TOOL_LIST_FOR_PROMPT, null, 2)}

Previous Tool Results:
${
  previousToolResults.length === 0
    ? "None yet"
    : previousToolResults.map(r => `${r.tool}: ${r.resultSummary}`).join("\n")
}

Decide next action.
`;
}

// --------------------
// Safe JSON parse
// --------------------
function safeParseJSON(maybeJSON) {
  if (!maybeJSON) return null;
  try { return JSON.parse(maybeJSON); } catch {}
  const match = String(maybeJSON).match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }
  return null;
}

// --------------------
// Safe LLM invoke with retry for quota
// --------------------
async function safeLLMInvoke(llm, messages, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await llm.invoke(messages);
    } catch (e) {
      if (e.status === 429) {
        const waitTime = e.errorDetails?.[2]?.retryDelay?.replace("s", "") || 5;
        console.warn(`[Orchestrator] Rate limit hit. Retrying in ${waitTime}s...`);
        await new Promise(r => setTimeout(r, parseFloat(waitTime) * 1000));
      } else {
        throw e;
      }
    }
  }
  throw new Error("LLM invoke failed after retries due to quota.");
}

// --------------------
// Run Orchestrator
// --------------------
export async function runMCPOrchestrator(trip, { maxSteps = 6 } = {}) {
  if (!trip?.id || !trip?.destination_coords) {
    throw new Error("Trip must include id and destination_coords {lat, lng}");
  }

  const llm = createLLM();
  const previousToolResults = [];
  const messages = [new SystemMessage(SYSTEM_PROMPT)];

  for (let step = 1; step <= maxSteps; step++) {
    console.log(`\n[Orchestrator] Step ${step}/${maxSteps}`);

    const userPrompt = buildUserPrompt(trip, previousToolResults);
    const aiMsg = await safeLLMInvoke(llm, [...messages, new HumanMessage(userPrompt)]);
    const text = aiMsg?.content || "";

    console.log(`[Orchestrator] LLM Response:`, text.substring(0, 200));

    const parsed = safeParseJSON(text);
    if (!parsed || !parsed.action) {
      messages.push(
        new AIMessage(text),
        new HumanMessage("FORMAT_ERROR: Response was not valid JSON. Reply with only the JSON object.")
      );
      continue;
    }

    if (parsed.action === "final") {
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

      if (!tool) {
        messages.push(
          new AIMessage(text),
          new HumanMessage(`TOOL_ERROR: Unknown tool "${toolName}"`)
        );
        continue;
      }

      let args;
      try {
        args = tool.validate(parsed.arguments);
      } catch (e) {
        messages.push(
          new AIMessage(text),
          new HumanMessage(`ARG_ERROR: ${e.message}`)
        );
        continue;
      }

      try {
        const result = await tool.execute(args);
        previousToolResults.push({
          step,
          tool: toolName,
          args,
          resultSummary: result?.summary || null,
          result,
        });

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

      } catch (e) {
        messages.push(
          new AIMessage(text),
          new HumanMessage(`TOOL_RUNTIME_ERROR: ${e.message}`)
        );
      }
    }
  }

  return {
    status: "PARTIAL",
    message: "Max steps reached without finalization.",
    toolResults: previousToolResults,
  };
}
