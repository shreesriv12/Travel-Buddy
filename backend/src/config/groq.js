import "dotenv/config";
import OpenAI from "openai";

function providerConfig() {
  if (process.env.GROQ_API_KEY) {
    return { name: "Groq", apiKey: process.env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1", model: process.env.GROQ_MODEL || "openai/gpt-oss-20b" };
  }
  throw new Error("GROQ_API_KEY is not set");
}

function client(config) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

export async function generateGroqText(system, user, temperature = 0.2, jsonMode = false) {
  const config = providerConfig();
  const response = await client(config).chat.completions.create({
    model: config.model,
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(jsonMode ? { response_format: { type: "json_object" }, include_reasoning: false, max_completion_tokens: 4096 } : {}),
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error(`${config.name} returned an empty response`);
  return text;
}
