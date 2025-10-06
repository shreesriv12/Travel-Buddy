import { z } from "zod";
import prisma from "../config/db.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

// --------------------
// Argument schema
// --------------------
const ItineraryArgs = z.object({
  tripId: z.string().uuid(),
  destination: z.string().min(1),
  days: z.number().min(1),
  startDate: z.string().optional(),
  adults: z.number().optional().default(1),
  children: z.number().optional().default(0),
  budgetResult: z.any().optional(),
});

// --------------------
// Extract JSON from LLM text
// --------------------
function extractJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Empty LLM output");
  }

  const cleaned = text.trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.log("Direct JSON parse failed");
  }

  // Try to extract from code blocks
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {
      console.log("Code block extraction failed");
    }
  }

  // Try to find JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.log("JSON object extraction failed");
    }
  }

  throw new Error("Failed to extract JSON from LLM output");
}

// --------------------
// Fetch POIs from Gemini
// --------------------
async function fetchBestPlaces({ destination, days, startDate }) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.0-flash",
    temperature: 0.2,
  });

  const prompt = [
    "Return ONLY valid JSON array. Do not include markdown or code fences.",
    `Generate ${days} days worth of POIs for ${destination} starting ${startDate || "soon"}.`,
    "Each object MUST include: name, area, category, suggested_time_hrs, description",
    "Categories can be: landmark, museum, park, restaurant, shopping, entertainment, cultural, nature",
    "Example format:",
    `[{"name": "Eiffel Tower", "area": "Champ de Mars", "category": "landmark", "suggested_time_hrs": 2, "description": "Iconic iron tower"}]`
  ].join("\n");

  console.log("Fetching POIs for:", destination);

  const res = await model.invoke([new HumanMessage(prompt)]);
  const text = res?.content || "";

  const raw = extractJson(text);

  // Validate and transform POIs
  const Poi = z.object({
    name: z.string(),
    area: z.string().optional().default(""),
    category: z.string().optional().default("landmark"),
    suggested_time_hrs: z.number().optional().default(2),
    description: z.string().optional().default(""),
  });

  const parsedPois = z.array(Poi).parse(raw);
  return parsedPois;
}

// --------------------
// Allocate POIs across days
// --------------------
function allocatePoisToDays(pois, days) {
  const perDay = Array.from({ length: days }, () => ({ hrs: 0, items: [] }));
  const sorted = [...pois].sort((a, b) => (b.suggested_time_hrs || 2) - (a.suggested_time_hrs || 2));

  for (const p of sorted) {
    perDay.sort((a, b) => a.hrs - b.hrs);
    perDay[0].items.push(p);
    perDay[0].hrs += p.suggested_time_hrs || 2;
  }

  return perDay.map((d) => d.items);
}

// --------------------
// Format date to YYYY-MM-DD
// --------------------
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// --------------------
// Main Itinerary Execute
// --------------------
async function itineraryExecute(rawArgs) {
  console.log("Starting itinerary generation...");
  
  const args = ItineraryArgs.parse(rawArgs);

  // Fetch trip
  const trip = await prisma.trip.findUnique({ 
    where: { id: args.tripId } 
  });
  
  if (!trip) {
    throw new Error(`Trip ${args.tripId} not found`);
  }

  // Calculate budgets
  const totalBudget = args.budgetResult?.budget?.total ?? trip.total_budget ?? 1000;
  const dailyBudget = Math.round(totalBudget / args.days);

  // Get weather data from database (already stored by weatherAgent)
  const weatherData = await prisma.weatherData.findMany({
    where: { 
      trip_id: args.tripId,
      date: {
        gte: new Date(args.startDate || trip.start_date),
        lte: new Date(trip.end_date)
      }
    },
    orderBy: { date: 'asc' }
  });

  // Fetch POIs
  let pois = [];
  try {
    pois = await fetchBestPlaces({
      destination: trip.destination,
      days: args.days,
      startDate: args.startDate,
    });
    console.log(`Fetched ${pois.length} POIs`);
  } catch (err) {
    console.error("POI fetch failed:", err.message);
    // Create fallback POIs
    pois = [
      {
        name: `${trip.destination} City Center`,
        area: "City Center",
        category: "landmark",
        suggested_time_hrs: 3,
        description: "Explore the heart of the city"
      },
      {
        name: "Local Museum",
        area: "Cultural District",
        category: "museum",
        suggested_time_hrs: 2,
        description: "Discover local history and culture"
      },
      {
        name: "Main Park",
        area: "Green Area",
        category: "park",
        suggested_time_hrs: 2,
        description: "Relax and enjoy nature"
      }
    ];
  }

  // Allocate POIs to days
  const dailyBuckets = allocatePoisToDays(pois, args.days);

  // Build itinerary
  const baseDate = args.startDate ? new Date(args.startDate) : new Date(trip.start_date);
  const plan = [];

  // Clear existing itinerary items
  await prisma.itineraryItem.deleteMany({
    where: { trip_id: args.tripId }
  });

  for (let i = 0; i < args.days; i++) {
    const dayDate = new Date(baseDate);
    dayDate.setDate(baseDate.getDate() + i);
    const dateStr = formatDate(dayDate);

    // Find weather for this day
    const dayWeather = weatherData.find(w => formatDate(w.date) === dateStr) || {};
    
    // Get POIs for this day
    const dayPois = dailyBuckets[i] || [];

    // Create day plan
    const dayPlan = {
      day: i + 1,
      date: dateStr,
      weather: {
        temp_high: dayWeather.temperature_high || 25,
        temp_low: dayWeather.temperature_low || 18,
        condition: dayWeather.conditions || "Partly Cloudy"
      },
      places: dayPois.map(p => ({
        name: p.name,
        area: p.area,
        category: p.category,
        suggested_time_hrs: p.suggested_time_hrs,
        description: p.description
      })),
      est_hours: dayPois.reduce((sum, p) => sum + (p.suggested_time_hrs || 2), 0),
      budget: {
        daily_estimated: dailyBudget,
        total_estimated: totalBudget
      }
    };

    plan.push(dayPlan);

    // Store in database
    await prisma.itineraryItem.create({
      data: {
        trip_id: trip.id,
        day_number: i + 1,
        title: `Day ${i + 1} in ${trip.destination}`,
        description: `Activities: ${dayPois.map(p => p.name).join(', ')}`,
        start_time: new Date(`${dateStr}T09:00:00Z`),
        end_time: new Date(`${dateStr}T18:00:00Z`),
        location: trip.destination,
        location_coords: trip.destination_coords || {},
        category: "Day Plan",
        estimated_cost: dailyBudget,
        sort_order: i + 1,
      },
    });
  }

  // Update trip summary
  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      summary: {
        generated: true,
        days: args.days,
        plan,
      },
    },
  });

  return {
    summary: `Generated ${args.days}-day itinerary for ${trip.destination} with ${pois.length} POIs`,
    tripId: trip.id,
    plan,
  };
}

export const itineraryAgent = {
  name: "itineraryAgent",
  description: "AI-powered itinerary generator with daily POIs, weather, and budgets.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string" },
      destination: { type: "string" },
      days: { type: "number" },
      startDate: { type: "string" },
      adults: { type: "number" },
      children: { type: "number" },
      budgetResult: { type: "object" }
    },
    required: ["tripId", "destination", "days"]
  },
  validate: (args) => ItineraryArgs.parse(args),
  execute: itineraryExecute,
};