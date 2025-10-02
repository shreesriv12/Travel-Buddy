import prisma from "../config/db.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import axios from "axios";
import { z } from "zod";

// --------------------
// Argument schema
// --------------------
const BudgetArgs = z.object({
  tripId: z.string().uuid(),
  airline: z.string().optional(), // optional airline filter
});

// --------------------
// Helper: safe parse kgmid
// --------------------
function safeParseKgmid(responseText) {
  if (!responseText) return null;
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = codeBlockMatch ? codeBlockMatch[1] : responseText;

  try {
    const parsed = JSON.parse(jsonText);
    return parsed.kgmid;
  } catch (e) {
    throw new Error(`Failed to parse kgmid from Gemini response: ${e.message}`);
  }
}

// --------------------
// Fetch kgmid via Gemini
// --------------------
async function fetchKgmid(city) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");

  const llm = new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.0-flash",
    temperature: 0,
  });

  const systemMsg = new AIMessage(
    `You are a helpful assistant that returns the Google kgmid for a city in JSON: { "kgmid": "<value>" }`
  );
  const humanMsg = new HumanMessage(`Find the Google kgmid code for the city: "${city}"`);

  const response = await llm.invoke([systemMsg, humanMsg]);
  const kgmid = safeParseKgmid(response.content);

  if (!kgmid) throw new Error(`kgmid not found for city ${city}`);
  return kgmid;
}

// --------------------
// Fetch flights from SerpApi
// --------------------
async function fetchFlights({ departureKgmid, arrivalKgmid, startDate, endDate, adults, airline }) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY is not set");

  const params = {
    engine: "google_flights",
    departure_id: departureKgmid,
    arrival_id: arrivalKgmid,
    outbound_date: startDate,
    return_date: endDate,
    adults,
    api_key: apiKey,
  };

  if (airline) params.airlines = airline;

  const response = await axios.get("https://serpapi.com/search", { params });
  return response.data;
}

// --------------------
// Fetch hotels from SerpApi
// --------------------
async function fetchHotels({ destination, startDate, endDate, adults }) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY is not set");

  const response = await axios.get("https://serpapi.com/search", {
    params: {
      engine: "google_hotels",
      q: destination,
      check_in_date: startDate,
      check_out_date: endDate,
      adults,
      sort_by: "8", // cheapest first
      api_key: apiKey,
    },
  });

  return response.data;
}

// --------------------
// Estimate budget
// --------------------
function estimateBudget(flightsData, hotelsData, adults) {
  const flights = flightsData?.flights || [];
  const hotels = hotelsData?.hotels || [];

  const cheapestFlight =
    flights.reduce((min, f) => (f.price < min.price ? f : min), flights[0] || { price: 0 }) || { price: 0 };
  const cheapestHotel =
    hotels.reduce((min, h) => (h.price < min.price ? h : min), hotels[0] || { price: 0 }) || { price: 0 };

  return {
    estimatedTotalCost: (cheapestFlight.price + cheapestHotel.price) * adults,
    cheapestFlight,
    cheapestHotel,
  };
}

// --------------------
// Main execute function
// --------------------
async function budgetExecute(args) {
  const { tripId, airline } = BudgetArgs.parse(args);

  // Fetch trip from Prisma Trips table
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new Error("Trip not found");

  const adults = trip.adults || 1;

  // 1. Get kgmid codes from trip origin & destination
  const departureKgmid = await fetchKgmid(trip.origin);
  const arrivalKgmid = await fetchKgmid(trip.destination);

  // 2. Fetch flights & hotels
  const flightsData = await fetchFlights({
    departureKgmid,
    arrivalKgmid,
    startDate: trip.start_date.toISOString().split("T")[0],
    endDate: trip.end_date.toISOString().split("T")[0],
    adults,
    airline,
  });

  const hotelsData = await fetchHotels({
    destination: trip.destination,
    startDate: trip.start_date.toISOString().split("T")[0],
    endDate: trip.end_date.toISOString().split("T")[0],
    adults,
  });

  // 3. Calculate budget
  const budget = estimateBudget(flightsData, hotelsData, adults);

  // 4. Save BudgetItem linked to Trips table
  await prisma.budgetItem.create({
    data: {
      trip_id: trip.id,
      category: "Travel + Accommodation",
      item_name: "Estimated Trip Cost",
      estimated_amount: budget.estimatedTotalCost,
      actual_amount: 0,
      status: "Pending",
    },
  });

  return {
    summary: `Found ${topFlights.length} flights and ${topHotels.length} hotels. Total estimate: ${budget.currency} ${budget.total} (${budget.currency} ${budget.perPerson}/person)`,
    
    budget: {
      total: budget.total,
      perPerson: budget.perPerson,
      currency: budget.currency,
      status: budgetStatus,
      breakdown: budget.breakdown,
    },

    flights: {
      count: topFlights.length,
      cheapest: topFlights[0] || null,
      options: topFlights.map(f => ({
        airline: f.airline,
        price: `${f.currency} ${f.price}`,
        duration: f.duration > 0 ? `${Math.floor(f.duration / 60)}h ${f.duration % 60}m` : "N/A",
        stops: f.stops === 0 ? "Non-stop" : `${f.stops} stop(s)`,
      })),
    },

    hotels: {
      count: topHotels.length,
      cheapest: topHotels[0] || null,
      options: topHotels.map(h => ({
        name: h.name,
        rating: `${h.rating}/5 (${h.reviewCount} reviews)`,
        price: `${h.currency} ${h.pricePerNight}/night`,
        location: h.location,
      })),
    },

    recommendations: {
      bestFlightDeal: topFlights[0]?.airline || "Check airlines directly",
      bestHotelDeal: topHotels[0]?.name || "Check booking sites",
      savingTips: [
        topFlights.length > 1 && topFlights[0]?.stops > 0 ? "Direct flights available at higher price" : "Book early for better deals",
        `Trip duration: ${tripDuration} days - plan accordingly`,
        "Compare prices across multiple booking sites",
      ],
    },

    tripInfo: {
      origin: trip.origin,
      destination: trip.destination,
      duration: `${tripDuration} day${tripDuration > 1 ? "s" : ""}`,
      travelers: adults,
    },
  };
}

// --------------------
// Export agent
// --------------------
export const budgetAgent = {
  name: "budgetAgent",
  description:
    "Fetches flights and hotels for a trip using origin & destination from Trips table, estimates total budget, and stores it in BudgetItem linked to Trips table.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string", description: "Trip UUID" },
      airline: { type: "string", description: "Optional airline code to filter flights" },
    },
    required: ["tripId"],
  },
  validate: (args) => BudgetArgs.parse(args),
  execute: budgetExecute,
};
