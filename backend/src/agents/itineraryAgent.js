import { z } from "zod";
import prisma from "../config/db.js";
import { weatherAgent } from "./weatherAgent.js";
import { formatInTimeZone } from "date-fns-tz";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"; // LangChain Gemini [web:262]

// -------- Schema --------
const ItineraryArgs = z.object({
  tripId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  title: z.string().optional(),
  origin: z.string().optional(),
  origin_coords: z.any().optional(),
  destination: z.string().min(1),
  destination_coords: z.any().optional(),
  days: z.number().min(1),
  startDate: z.string().optional(), // YYYY-MM-DD
  total_budget: z.number().optional(),
});

// -------- Trip ensure --------
async function ensureTrip(args) {
  const {
    tripId,
    userId,
    title,
    origin,
    origin_coords,
    destination,
    destination_coords,
    days,
    startDate,
    total_budget,
  } = args;

  if (tripId) {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new Error("Trip not found");
    return trip;
  }

  if (!userId) throw new Error("userId is required to create a new Trip");

  const today = new Date();
  const start = startDate ? new Date(`${startDate}T00:00:00Z`) : today;
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + (days || 1) - 1);

  const trip = await prisma.trip.create({
    data: {
      user_id: userId,
      title: title || `Trip to ${destination}`,
      origin: origin || "Unknown",
      origin_coords: origin_coords ?? {},
      destination,
      destination_coords: destination_coords ?? {},
      start_date: start,
      end_date: end,
      adults: 1,
      status: "PLANNED",
      total_budget: total_budget ?? 0,
      summary: {},
    },
  });
  return trip;
}

// -------- Robust JSON extractor for LLM output --------
function extractJson(text) {
  if (!text || typeof text !== "string") throw new Error("Empty LLM output");
  const cleaned = text.replace(/^\uFEFF/, "").trim();

  // 1) Direct parse attempt
  try { return JSON.parse(cleaned); } catch (_) {}

  // 2) Extract from fenced code blocks `````` or ``````
  const blocks = [];
  const fenceRe = /``````/gi;
  let m;
  while ((m = fenceRe.exec(cleaned)) !== null) {
    const candidate = m[1].trim();
    try { return JSON.parse(candidate); } catch (e) { blocks.push({ candidate, e }); }
  }

  // 3) Fallback: first JSON-looking slice
  const startIdx = Math.min(
    ...[cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0)
  );
  if (isFinite(startIdx) && startIdx >= 0) {
    for (let end = cleaned.length; end > startIdx; end--) {
      const slice = cleaned.slice(startIdx, end).trim();
      if (!slice) continue;
      const closes = slice.endsWith("}") || slice.endsWith("]");
      if (!closes) continue;
      try { return JSON.parse(slice); } catch (_) {}
    }
  }

  const diag = blocks.length
    ? `Tried ${blocks.length} fenced blocks without success`
    : "No fenced blocks found";
  throw new Error(`Failed to extract JSON from LLM output. ${diag}`);
} // Handles Gemini code fences reliably [web:303][web:306]

// -------- Gemini prompt & fetch --------
function buildPoiPrompt({ destination, days, startDate }) {
  return [
    "Return ONLY JSON. Do not include markdown or code fences.",
    `Produce an array of the best places (POIs) in ${destination} for a ${days}-day trip starting ${startDate || "soon"}.`,
    "Each object MUST include:",
    "- name: string",
    "- area: string",
    "- category: string",
    "- suggested_time_hrs: number",
    "- ticket_url: string|null",
    "- description: string",
  ].join("\n");
} // Instructs JSON-only output; extractor still guards [web:322]

// Use ChatGoogleGenerativeAI; if JSON mode becomes supported, switch to that
async function fetchBestPlaces({ destination, days, startDate }) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");

  const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.0-flash",
    temperature: 0.2,
    // responseMimeType may not be supported by this class; using extractor instead [web:319]
  });

  const prompt = buildPoiPrompt({ destination, days, startDate });
  const res = await model.invoke(prompt);

  // Normalize content to string
  const text =
    typeof res?.content === "string"
      ? res.content
      : res?.content?.[0]?.text || res?.content?.text || "";

  const raw = extractJson(text); // robust to fenced output [web:303]
  // Zod-validate structure
  const Poi = z.object({
    name: z.string(),
    area: z.string().optional().default(""),
    category: z.string().optional().default(""),
    suggested_time_hrs: z.number().optional().default(2),
    ticket_url: z.string().nullable().optional(),
    description: z.string().optional().default(""),
  });
  const PoiArray = z.array(Poi);
  return PoiArray.parse(raw); // structured output validation [web:261]
}

// -------- Distribute POIs across days --------
function allocatePoisToDays(pois, days) {
  const perDay = Array.from({ length: days }, () => ({ hrs: 0, items: [] }));
  const sorted = [...pois].sort(
    (a, b) => (b.suggested_time_hrs || 2) - (a.suggested_time_hrs || 2)
  );
  for (const p of sorted) {
    perDay.sort((a, b) => a.hrs - b.hrs);
    perDay[0].items.push(p);
    perDay[0].hrs += p.suggested_time_hrs || 2;
  }
  return perDay.map((d) => d.items);
}

// -------- Main execute --------
async function itineraryExecute(rawArgs) {
  const args = ItineraryArgs.parse(rawArgs);

  const trip = await ensureTrip(args);

  // Destination coords/timezone
  const destCoords =
    (trip.destination_coords && typeof trip.destination_coords === "object"
      ? trip.destination_coords
      : {}) || {};
  const lat = destCoords.lat ?? 0;
  const lng = destCoords.lng ?? 0;
  const tz = destCoords.timezone || "UTC";

  // Weather (unchanged flow)
  let weatherData = null;
  try {
    weatherData = await weatherAgent.execute({
      tripId: trip.id,
      lat,
      lng,
      destination: trip.destination,
      granularity: "daily",
    });
  } catch (err) {
    console.error("Weather fetch failed:", err?.message || err);
  }

  // Gemini POIs (instead of events/budget)
  let pois = [];
  try {
    pois = await fetchBestPlaces({
      destination: trip.destination,
      days: args.days,
      startDate: args.startDate,
    });
  } catch (err) {
    console.error("POI fetch failed:", err?.message || err);
  }

  // Date helpers
  const toLocalYYYYMMDD = (d) => formatInTimeZone(d, tz, "yyyy-MM-dd"); // timezone-safe [web:49]
  const hasStart = typeof args.startDate === "string" && args.startDate.trim().length >= 10;
  const base = hasStart ? new Date(`${args.startDate}T00:00:00Z`) : new Date();

  const plan = [];
  const weatherDaily = weatherData?.daily || weatherData?.raw?.daily || null;

  const buckets = allocatePoisToDays(pois, args.days);

  for (let i = 0; i < args.days; i++) {
    const dayDate = new Date(base);
    dayDate.setUTCDate(base.getUTCDate() + i);
    const dateStr = toLocalYYYYMMDD(dayDate);

    // WEATHER: daily preferred; fallback to noon snapshot
    let weather = null;
    if (Array.isArray(weatherDaily)) {
      const wd =
        weatherDaily.find(
          (d) =>
            d?.date === dateStr || d?.valid_date === dateStr || d?.day === dateStr
        ) || null;
      if (wd) {
        weather = {
          temp_high:
            wd.temp_max ?? wd.max_temp ?? wd.max ?? wd.temperature_max ?? null,
          temp_low:
            wd.temp_min ?? wd.min_temp ?? wd.min ?? wd.temperature_min ?? null,
          condition:
            wd.condition ?? wd.summary ?? wd.weather?.[0]?.main ?? wd.icon ?? null,
        };
      }
    } else {
      const list = weatherData?.raw?.list || [];
      const snap =
        list.find(
          (f) =>
            typeof f?.dt_txt === "string" &&
            f.dt_txt.startsWith(dateStr) &&
            f.dt_txt.includes("12:00:00")
        ) ||
        list.find((f) => typeof f?.dt_txt === "string" && f.dt_txt.startsWith(dateStr)) ||
        null;
      if (snap?.main) {
        weather = {
          temp_high: snap.main.temp_max ?? null,
          temp_low: snap.main.temp_min ?? null,
          condition: snap.weather?.[0]?.main ?? null,
        };
      }
    }

    // PLACES: POIs for this day
    const places = (buckets[i] || []).map((p) => ({
      name: p.name,
      area: p.area || "",
      category: p.category || "",
      suggested_time_hrs: p.suggested_time_hrs || 2,
      ticket_url: p.ticket_url || null,
      description: p.description || "",
    }));

    const estHours = places.reduce((sum, p) => sum + (p.suggested_time_hrs || 2), 0);

    // Persist daily ItineraryItem summary
    await prisma.itineraryItem.create({
      data: {
        trip_id: trip.id,
        day_number: i + 1,
        title: `Day ${i + 1} in ${trip.destination}`,
        description: `Planned POIs: ${places.map((p) => p.name).join(", ").slice(0, 400)}`,
        start_time: new Date(`${dateStr}T09:00:00Z`),
        end_time: new Date(`${dateStr}T21:00:00Z`),
        location: trip.destination,
        location_coords: trip.destination_coords ?? {},
        category: "Day Plan",
        estimated_cost: 0,
        sort_order: i + 1,
      },
    });

    // Persist weather row if available
    if (weather) {
      await prisma.weatherData.create({
        data: {
          trip_id: trip.id,
          location: trip.destination,
          date: new Date(`${dateStr}T00:00:00Z`),
          temperature_high: weather.temp_high ?? 0,
          temperature_low: weather.temp_low ?? 0,
          conditions: weather.condition || "Unknown",
          precipitation: 0,
          weather_json: {},
        },
      });
    }

    // Collect response plan day
    plan.push({
      day: i + 1,
      date: dateStr,
      weather: weather || null,
      places,
      budget: null,
      est_hours: estHours,
    });
  }

  // Update Trip.summary JSON
  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      summary: {
        summary: `Generated ${args.days}-day itinerary (Gemini POIs) for ${trip.destination}`,
        plan,
      },
    },
  });

  return {
    summary: `Generated ${args.days}-day itinerary (Gemini POIs) for ${trip.destination}`,
    tripId: trip.id,
    plan,
  };
}

// -------- Export --------
export const itineraryAgent = {
  name: "itineraryAgent",
  description:
    "Generates a daily travel plan using DB trip data + weather and Gemini-curated places; persists WeatherData and ItineraryItem.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string", description: "Existing Trip UUID (optional)" },
      userId: { type: "string", description: "User UUID when creating Trip" },
      title: { type: "string", description: "Trip title" },
      origin: { type: "string", description: "Origin city" },
      origin_coords: { type: "object", description: "Origin coordinates JSON" },
      destination: { type: "string", description: "Destination city" },
      destination_coords: { type: "object", description: "Destination coordinates JSON" },
      days: { type: "number", description: "Number of days" },
      startDate: { type: "string", description: "Start date YYYY-MM-DD (optional)" },
      total_budget: { type: "number", description: "Total budget (optional)" },
    },
    required: ["destination", "days"],
  },
  validate: (args) => ItineraryArgs.parse(args),
  execute: itineraryExecute,
};
