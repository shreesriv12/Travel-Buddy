// --------------------
// Imports & setup
// --------------------
// Debug: Importing Zod for argument validation.
import { z } from "zod";
console.log("DEBUG: Zod imported.");
// Debug: Importing Prisma client for database interaction.
import prisma from "../config/db.js";
console.log("DEBUG: Prisma imported.");
// Debug: Importing the weather agent.
import { weatherAgent } from "./weatherAgent.js";
console.log("DEBUG: weatherAgent imported.");
// Debug: Importing date formatting utility.
import { formatInTimeZone } from "date-fns-tz";
console.log("DEBUG: date-fns-tz imported.");
// Debug: Importing Google Generative AI for LLM calls.
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
console.log("DEBUG: ChatGoogleGenerativeAI imported.");

// --------------------
// Argument schema
// --------------------
// Debug: Defining the Zod schema for ItineraryArgs.
const ItineraryArgs = z.object({
  tripId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  title: z.string().optional(),
  origin: z.string().optional(),
  origin_coords: z.any().optional(),
  destination: z.string().min(1),
  destination_coords: z.any().optional(),
  days: z.number().min(1),
  startDate: z.string().optional(),
  total_budget: z.number().optional(),
  budgetResult: z.any().optional(),
  adults: z.number().optional().default(1),
  children: z.number().optional().default(0),
});
console.log("DEBUG: ItineraryArgs Zod schema defined.");

// --------------------
// Ensure trip exists or create new
// --------------------
// Debug: Defining the ensureTrip function.
async function ensureTrip(args) {
  console.log("DEBUG: Entering ensureTrip function with args:", args);
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
    adults,
    children,
  } = args;

  // Debug: Checking if a tripId was provided.
  if (tripId) {
    console.log(`DEBUG: tripId provided. Searching for trip with ID: ${tripId}`);
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      console.error(`ERROR: Trip with ID ${tripId} not found.`);
      throw new Error("Trip not found");
    }
    console.log("DEBUG: Found existing trip:", trip.id);
    return trip;
  }

  // Debug: If no tripId, checking for userId to create a new trip.
  console.log("DEBUG: No tripId provided. Attempting to create a new trip.");
  if (!userId) {
    console.error("ERROR: userId is required to create a new Trip.");
    throw new Error("userId is required to create a new Trip");
  }
  console.log(`DEBUG: Creating new trip for user: ${userId}`);

  // Debug: Calculating start and end dates.
  const today = new Date();
  const start = startDate ? new Date(`${startDate}T00:00:00Z`) : today;
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + (days || 1) - 1);
  console.log(`DEBUG: New trip dates calculated: Start=${start}, End=${end}`);

  // Debug: Creating the new trip in the database.
  const newTrip = await prisma.trip.create({
    data: {
      user_id: userId,
      title: title || `Trip to ${destination}`,
      origin: origin || "Unknown",
      origin_coords: origin_coords ?? {},
      destination,
      destination_coords: destination_coords ?? {},
      start_date: start,
      end_date: end,
      adults,
      children,
      status: "PLANNED",
      total_budget: total_budget ?? 0,
      summary: {},
    },
  });
  console.log(`DEBUG: New trip created with ID: ${newTrip.id}`);
  return newTrip;
}

// --------------------
// Extract JSON from LLM text
// --------------------
// Debug: Defining the extractJson function.
function extractJson(text) {
  console.log("DEBUG: Entering extractJson.");
  if (!text || typeof text !== "string") {
    console.error("ERROR: LLM output is empty or not a string.");
    throw new Error("Empty LLM output");
  }

  // Debug: Cleaning up potential BOM character.
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  console.log("DEBUG: Cleaned text:", cleaned.slice(0, 50) + "...");

  // Debug: Attempting a direct parse.
  try {
    const parsed = JSON.parse(cleaned);
    console.log("DEBUG: Successfully parsed JSON directly.");
    return parsed;
  } catch (e) {
    console.log("DEBUG: Direct JSON parse failed, trying to find a JSON block.");
  }

  // Debug: Searching for a JSON object or array block.
  const startIdx = Math.min(
    ...[cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0)
  );
  console.log("DEBUG: Found start index for JSON block:", startIdx);
  if (isFinite(startIdx) && startIdx >= 0) {
    // Debug: Looping backwards to find the end of the JSON.
    for (let end = cleaned.length; end > startIdx; end--) {
      const slice = cleaned.slice(startIdx, end).trim();
      if (!slice) continue;
      // Debug: Checking for valid JSON end characters.
      if (!slice.endsWith("}") && !slice.endsWith("]")) continue;
      try {
        const parsedSlice = JSON.parse(slice);
        console.log("DEBUG: Successfully extracted and parsed JSON from slice.");
        return parsedSlice;
      } catch (e) {
        // Debug: Log failed slice parse attempts.
        console.log("DEBUG: Failed to parse slice, moving to next possibility.");
      }
    }
  }
  // Debug: If no JSON was found.
  console.error("ERROR: Failed to extract any valid JSON from LLM output.");
  throw new Error("Failed to extract JSON from LLM output");
}

// --------------------
// Build POI prompt
// --------------------
// Debug: Defining the prompt builder function.
function buildPoiPrompt({ destination, days, startDate }) {
  console.log("DEBUG: Building POI prompt.");
  const prompt = [
    "Return ONLY JSON. Do not include markdown or code fences.",
    `Produce an array of the best POIs in ${destination} for a ${days}-day trip starting ${startDate || "soon"}.`,
    "Each object MUST include: name, area, category, suggested_time_hrs, ticket_url, description",
  ].join("\n");
  console.log("DEBUG: Generated prompt:", prompt);
  return prompt;
}

// --------------------
// Fetch POIs from Gemini
// --------------------
// Debug: Defining the fetchBestPlaces function.
async function fetchBestPlaces({ destination, days, startDate }) {
  console.log("DEBUG: Entering fetchBestPlaces.");
  // Debug: Checking for Google API key.
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("ERROR: GOOGLE_API_KEY is not set.");
    throw new Error("GOOGLE_API_KEY is not set");
  }
  console.log("DEBUG: Google API key is available.");

  // Debug: Initializing the Gemini model.
  const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.0-flash",
    temperature: 0.2,
  });
  console.log("DEBUG: Gemini LLM model initialized.");

  // Debug: Building the prompt and invoking the model.
  const prompt = buildPoiPrompt({ destination, days, startDate });
  console.log("DEBUG: Invoking Gemini model for POIs...");
  const res = await model.invoke(prompt);
  console.log("DEBUG: Gemini response received.");

  // Debug: Extracting the content from the response object.
  const text =
    res?.content?.[0]?.text ||
    res?.content?.text ||
    (typeof res?.content === "string" ? res.content : "");
  console.log("DEBUG: Raw LLM text content:", text.slice(0, 50) + "...");

  // Debug: Attempting to extract and parse the JSON.
  const raw = extractJson(text);
  console.log("DEBUG: Extracted raw POI data:", raw);

  // Debug: Defining the Zod schema for a single POI.
  const Poi = z.object({
    name: z.string(),
    area: z.string().optional().default(""),
    category: z.string().optional().default(""),
    suggested_time_hrs: z.number().optional().default(2),
    ticket_url: z.string().nullable().optional(),
    description: z.string().optional().default(""),
  });
  // Debug: Parsing the extracted data against the array schema.
  console.log("DEBUG: Parsing raw POI data with Zod schema.");
  const parsedPois = z.array(Poi).parse(raw);
  console.log(`DEBUG: Successfully parsed ${parsedPois.length} POIs.`);
  return parsedPois;
}

// --------------------
// Allocate POIs across days
// --------------------
// Debug: Defining the POI allocation function.
function allocatePoisToDays(pois, days) {
  console.log(`DEBUG: Allocating ${pois.length} POIs across ${days} days.`);
  // Debug: Initializing daily buckets.
  const perDay = Array.from({ length: days }, () => ({ hrs: 0, items: [] }));
  // Debug: Sorting POIs by suggested time.
  const sorted = [...pois].sort(
    (a, b) => (b.suggested_time_hrs || 2) - (a.suggested_time_hrs || 2)
  );
  console.log("DEBUG: POIs sorted by time descending.");
  // Debug: Distributing POIs to the day with the least hours.
  for (const p of sorted) {
    perDay.sort((a, b) => a.hrs - b.hrs);
    perDay[0].items.push(p);
    perDay[0].hrs += p.suggested_time_hrs || 2;
  }
  console.log("DEBUG: POIs successfully allocated to daily buckets.");
  // Debug: Returning only the items from each bucket.
  const result = perDay.map((d) => d.items);
  console.log("DEBUG: Allocation result:", result);
  return result;
}

// --------------------
// Main Itinerary Execute
// --------------------
// Debug: Defining the main agent execution function.
async function itineraryExecute(rawArgs) {
  console.log("DEBUG: Starting itineraryExecute function.");
  // Debug: Parsing and validating the raw arguments.
  const args = ItineraryArgs.parse(rawArgs);
  console.log("DEBUG: Arguments parsed successfully:", args);
  // Debug: Ensuring a trip exists or creating a new one.
  const trip = await ensureTrip(args);
  console.log("DEBUG: Trip object:", trip);

  // Debug: Calculating total and daily budgets.
  const totalBudget = args.budgetResult?.budget?.total ?? trip.total_budget ?? 0;
  const dailyBudget = Math.round(totalBudget / (args.days || 1));
  console.log(`DEBUG: Total budget: ${totalBudget}, Daily budget: ${dailyBudget}`);

  // Debug: Extracting destination coordinates and timezone.
  const destCoords = trip.destination_coords ?? {};
  const lat = destCoords.lat ?? 0;
  const lng = destCoords.lng ?? 0;
  const tz = destCoords.timezone || "UTC";
  console.log(`DEBUG: Destination coords: lat=${lat}, lng=${lng}, timezone=${tz}`);

  // Debug: Calling the weather agent.
  let weatherDaily = [];
  try {
    console.log("DEBUG: Calling weatherAgent...");
    const weatherData = await weatherAgent.execute({
      tripId: trip.id,
      lat,
      lng,
      destination: trip.destination,
    });
    weatherDaily = weatherData?.daily || [];
    console.log(`DEBUG: Weather data fetched successfully for ${weatherDaily.length} days.`);
  } catch (err) {
    console.error("ERROR: Weather fetch failed:", err?.message || err);
  }

  // Debug: Calling the LLM to fetch POIs.
  let pois = [];
  try {
    console.log("DEBUG: Calling fetchBestPlaces to get POIs...");
    pois = await fetchBestPlaces({
      destination: trip.destination,
      days: args.days,
      startDate: args.startDate,
    });
    console.log(`DEBUG: Fetched ${pois.length} POIs.`);
  } catch (err) {
    console.error("ERROR: POI fetch failed:", err?.message || err);
  }

  // Debug: Allocating POIs to daily buckets.
  console.log("DEBUG: Allocating POIs to days.");
  const buckets = allocatePoisToDays(pois, args.days);
  
  // Debug: Initializing date formatting and base date.
  const toLocalYYYYMMDD = (d) => formatInTimeZone(d, tz, "yyyy-MM-dd");
// Corrected base date
const base = args.startDate ? new Date(args.startDate) : new Date();
console.log("DEBUG: Base date for itinerary:", base);

  // Debug: Initializing the plan array.
  const plan = [];

  // Debug: Looping through each day to build the itinerary.
  for (let i = 0; i < args.days; i++) {
    console.log(`DEBUG: Building plan for Day ${i + 1}`);
    const dayDate = new Date(base);
    dayDate.setUTCDate(base.getUTCDate() + i);
    const dateStr = toLocalYYYYMMDD(dayDate);
    console.log(`DEBUG: Day date string: ${dateStr}`);

    // Debug: Finding and structuring weather data for the current day.
    const wd = weatherDaily.find((d) => d.date === dateStr) || {};
    const weather = {
      temp_high: wd.temp_high ?? null,
      temp_low: wd.temp_low ?? null,
      condition: wd.condition ?? "Unknown",
    };
    console.log("DEBUG: Daily weather data:", weather);

    // Debug: Mapping the POIs for the current day to the final format.
    const places = (buckets[i] || []).map((p) => ({
      name: p.name,
      area: p.area || "",
      category: p.category || "",
      suggested_time_hrs: p.suggested_time_hrs || 2,
      ticket_url: p.ticket_url || null,
      description: p.description || "",
    }));
    console.log(`DEBUG: Places planned for day ${i + 1}:`, places.map(p => p.name));

    // Debug: Calculating estimated hours for the day.
    const estHours = places.reduce((sum, p) => sum + (p.suggested_time_hrs || 2), 0);
    console.log(`DEBUG: Estimated activity hours for day ${i + 1}: ${estHours}`);

    // Debug: Storing the itinerary item in the database.
    console.log(`DEBUG: Storing itinerary item for Day ${i + 1} in database.`);
    await prisma.itineraryItem.create({
      data: {
        trip_id: trip.id,
        day_number: i + 1,
        title: `Day ${i + 1} in ${trip.destination}`,
        description: `Planned POIs: ${places.map((p) => p.name).join(", ")}`,
        start_time: new Date(`${dateStr}T09:00:00Z`),
        end_time: new Date(`${dateStr}T21:00:00Z`),
        location: trip.destination,
        location_coords: trip.destination_coords ?? {},
        category: "Day Plan",
        estimated_cost: dailyBudget,
        sort_order: i + 1,
      },
    });
    console.log("DEBUG: Itinerary item stored successfully.");

    // Debug: Pushing the daily plan to the main plan array.
    plan.push({
      day: i + 1,
      date: dateStr,
      weather,
      places,
      est_hours: estHours,
      budget: {
        daily_estimated: dailyBudget,
        total_estimated: totalBudget,
        total_actual: args.budgetResult?.budget?.total_actual ?? 0,
      },
    });
  }

  // Debug: Updating the trip summary in the database.
  console.log("DEBUG: Updating trip summary in database.");
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
  console.log("DEBUG: Trip summary updated.");

  // Debug: Returning the final structured response.
  console.log("DEBUG: Itinerary generation complete. Returning final object.");
  return {
    summary: `Generated ${args.days}-day itinerary for ${trip.destination}`,
    tripId: trip.id,
    plan,
  };
}

export const itineraryAgent = {
  name: "itineraryAgent",
  description: "AI-powered itinerary generator with daily POIs, weather, and budgets.",
  jsonSchema: ItineraryArgs.shape,
  validate: (args) => ItineraryArgs.parse(args),
  execute: itineraryExecute,
};
