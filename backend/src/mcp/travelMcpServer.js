import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { weatherAgent } from "../agents/weatherAgent.js";
import { flightAgent } from "../agents/flightAgent.js";
import { trainAgent } from "../agents/trainAgent.js";
import { hotelsAgent } from "../agents/hotelsAgent.js";
import { newsAgent } from "../agents/newsAgent.js";
import { budgetAgent } from "../agents/budgetAgent.js";
import { eventsAgent } from "../agents/eventsAgent.js";
import { itineraryAgent } from "../agents/itineraryAgent.js";
import { mapsAgent } from "../agents/mapsAgent.js";
import { reviewsAgent } from "../agents/reviewsAgent.js";

// Stdio is the MCP JSON-RPC channel. Agent diagnostics must never be written
// to stdout or they would corrupt protocol messages.
console.log = (...args) => console.error(...args);
console.warn = (...args) => console.error(...args);

const server = new McpServer({ name: "webster-travel-tools", version: "1.0.0" });
const agents = [weatherAgent, flightAgent, trainAgent, hotelsAgent, newsAgent, reviewsAgent, budgetAgent, eventsAgent, itineraryAgent, mapsAgent];

for (const agent of agents) {
  server.registerTool(agent.name, {
    description: agent.description,
    inputSchema: z.object({}).passthrough(),
  }, async (args) => {
    try {
      const result = await agent.execute(args);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      };
    }
  });
}

await server.connect(new StdioServerTransport());
