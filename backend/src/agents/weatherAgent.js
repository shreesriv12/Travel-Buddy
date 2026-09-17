import { z } from "zod";
import prisma from "../config/db.js";
import { generateGroqText } from "../config/groq.js";

const WeatherArgs = z.object({ tripId: z.string().uuid(), destination: z.string().min(1), startDate: z.string(), endDate: z.string() });

async function weatherExecute(args) {
  const { tripId, destination, startDate, endDate } = WeatherArgs.parse(args);
  const prompt = `Create planning-oriented weather guidance for ${destination}, ${startDate} through ${endDate}. This is NOT a live forecast. Return ONLY valid JSON: {"daily":[{"date":"YYYY-MM-DD","temp_high":number,"temp_low":number,"precipitation":number,"condition":"text"}]}. Use Celsius and precipitation percentage. Include every date from start inclusive to end exclusive. Do not claim the values are observed or live.`;
  const text = await generateGroqText("You produce clearly-labelled, non-live travel planning weather guidance. Never represent generated values as current weather.", prompt, 0.2);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The configured LLM did not return weather JSON");
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch { throw new Error("The configured LLM returned malformed weather JSON"); }
  const daily = (parsed.daily || []).filter((day) => day.date && Number.isFinite(Number(day.temp_high)) && Number.isFinite(Number(day.temp_low)));
  if (!daily.length) throw new Error("The configured LLM returned no weather guidance days");
  await prisma.weatherData.deleteMany({ where: { trip_id: tripId } });
  await prisma.weatherData.createMany({ data: daily.map((day) => ({ trip_id: tripId, location: destination, date: new Date(`${day.date}T00:00:00.000Z`), temperature_high: Number(day.temp_high), temperature_low: Number(day.temp_low), conditions: String(day.condition || "Seasonal planning guidance"), precipitation: Number(day.precipitation) || 0, weather_json: { provider: "Groq/OpenRouter LLM", generated: true, disclaimer: "AI-generated planning guidance; not a live forecast" }, fetched_at: new Date() })) });
  return { summary: `Generated Groq weather planning guidance for ${daily.length} days in ${destination}.`, daily, generated: true, disclaimer: "AI-generated planning guidance; not a live forecast" };
}

export const weatherAgent = { name: "weatherTool", description: "Generates non-live weather planning guidance with Groq.", jsonSchema: { type: "object", properties: { tripId: { type: "string" }, destination: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" } }, required: ["tripId", "destination", "startDate", "endDate"] }, validate: (args) => WeatherArgs.parse(args), execute: weatherExecute };
