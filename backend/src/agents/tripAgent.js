import "dotenv/config";
import prisma from "../config/db.js";
import fetch from "node-fetch";
import { generateGroqText } from "../config/groq.js";
import { runMCPOrchestrator } from "./orchestrator.js";

// --------------------
// Fetch coordinates from Geoapify
// --------------------
async function getCoordinatesGeoapify(location) {
  try {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(
      location
    )}&apiKey=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    const feature = data.features?.[0];
    if (feature?.geometry?.coordinates) {
      const [lon, lat] = feature.geometry.coordinates;
      return { lat, lng: lon };
    }

    console.warn(`No coordinates found for ${location}, using fallback.`);
    return { lat: 0, lng: 0 };
  } catch (err) {
    console.error(`Geoapify fetch failed for ${location}:`, err);
    return { lat: 0, lng: 0 };
  }
}

// --------------------
// Parse user prompt using Groq
// --------------------
async function parsePromptWithGroq(prompt) {
  const systemPrompt = `
You are a travel assistant. Parse the user prompt into JSON with these fields:
{
  "title": string,
  "origin": string,
  "destination": string,
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "adults": number,
  "total_budget": number,
  "currency": "ISO 4217 code, such as INR or USD",
  "status": string
}

Rules:
- Return ONLY valid JSON, no explanations.
- Dates must be in YYYY-MM-DD format.
- Extract origin and destination correctly.
- Use reasonable defaults if any field is missing.
`;

  const text = await generateGroqText(systemPrompt, prompt, 0);

  const cleaned = text.replace(/```json|```/gi, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Groq raw response:", cleaned);
    throw new Error("Failed to parse Groq response as JSON");
  }
}

// --------------------
// Main trip creation + orchestrator
// --------------------
export async function createTripAndRunOrchestrator({ userId, prompt }) {
  // 1️⃣ Parse prompt
  const tripDataRaw = await parsePromptWithGroq(prompt);

  // 2️⃣ Normalize city names
  const normalizeLocation = (name) => {
    const mapping = { Bombay: "Mumbai", Calcutta: "Kolkata" };
    return mapping[name] || name || "Unknown";
  };

  // 3️⃣ Normalize and set defaults
  const tripData = {
    title: tripDataRaw.title || `Trip to ${tripDataRaw.destination || "Unknown"}`,
    origin: tripDataRaw.origin || "Unknown",
    destination: tripDataRaw.destination || "Unknown",
    start_date: tripDataRaw.start_date || new Date().toISOString().split("T")[0],
    end_date: tripDataRaw.end_date || new Date().toISOString().split("T")[0],
    adults: typeof tripDataRaw.adults === "number" ? tripDataRaw.adults : 1,
    total_budget: typeof tripDataRaw.total_budget === "number" ? tripDataRaw.total_budget : 0,
    currency: tripDataRaw.currency || "INR",
    status: tripDataRaw.status || "planned",
  };

  console.log("=== Debug: Normalized tripData ===");
  console.log(tripData);

  // 4️⃣ Fetch coordinates in parallel
  const [origin_coords, destination_coords] = await Promise.all([
    getCoordinatesGeoapify(normalizeLocation(tripData.origin)),
    getCoordinatesGeoapify(normalizeLocation(tripData.destination)),
  ]);

  console.log("=== Debug: Coordinates ===");
  console.log("Origin coords:", origin_coords);
  console.log("Destination coords:", destination_coords);

  // 5️⃣ Create trip in DB
  const trip = await prisma.trip.create({
    data: {
      user_id: userId,
      title: tripData.title,
      origin: tripData.origin,
      origin_coords,
      destination: tripData.destination,
      destination_coords,
      start_date: new Date(tripData.start_date),
      end_date: new Date(tripData.end_date),
      adults: tripData.adults,
      status: tripData.status,
      total_budget: tripData.total_budget,
      summary: tripDataRaw
    },
  });

  console.log("=== Debug: Trip object before orchestrator ===");
  console.log(trip);

  const orchestratorResult = await runMCPOrchestrator(trip)

  return {
    tripId: trip.id,
    title: trip.title,
    origin: trip.origin,
    destination: trip.destination,
    origin_coords: trip.origin_coords,
    destination_coords: trip.destination_coords,
    start_date: trip.start_date,
    end_date: trip.end_date,
    adults: trip.adults,
    total_budget: trip.total_budget,
    status: orchestratorResult.status,
    // `answer` is not part of the orchestrator contract. Return the briefing
    // and execution metadata so the dashboard can explain what every agent did.
    orchestratorSummary: orchestratorResult.aiInsights,
    executionMetadata: orchestratorResult.executionMetadata,
    toolResults: orchestratorResult.toolResults,
  };
}
