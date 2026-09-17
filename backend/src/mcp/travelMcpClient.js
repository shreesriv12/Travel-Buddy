import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("./travelMcpServer.js", import.meta.url));

export async function createTravelMcpClient() {
  const client = new Client({ name: "webster-orchestrator", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath] }));

  return {
    async call(tool, args) {
      // Some OpenRouter models take longer than MCP's 60-second default.
      const response = await client.callTool({ name: tool, arguments: args }, undefined, { timeout: 120_000 });
      const text = response.content?.find((item) => item.type === "text")?.text || "";
      if (response.isError) throw new Error(text || `${tool} failed through MCP`);
      let result;
      try {
        result = JSON.parse(text);
        // Agents persist an empty result for an unavailable live provider, but
        // the roundtable must report that as a failed source—not "Ready".
      } catch {
        throw new Error(`${tool} returned an invalid MCP tool response`);
      }
      if (result?.unavailable) throw new Error(result.error || result.summary || `${tool} is unavailable`);
      return result;
    },
    close: () => client.close(),
  };
}
