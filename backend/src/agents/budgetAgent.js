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
  airline: z.string().optional(),
  maxBudget: z.number().optional(),
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

  try {
    const response = await axios.get("https://serpapi.com/search", { params });
    return response.data;
  } catch (error) {
    console.warn("[Budget Agent] Flight API error:", error.message);
    return { best_flights: [], other_flights: [] };
  }
}

// --------------------
// Fetch hotels from SerpApi
// --------------------
async function fetchHotels({ destination, startDate, endDate, adults }) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY is not set");

  try {
    const response = await axios.get("https://serpapi.com/search", {
      params: {
        engine: "google_hotels",
        q: destination,
        check_in_date: startDate,
        check_out_date: endDate,
        adults,
        sort_by: "8",
        api_key: apiKey,
      },
    });
    return response.data;
  } catch (error) {
    console.warn("[Budget Agent] Hotel API error:", error.message);
    return { properties: [] };
  }
}

// --------------------
// Safe number extraction
// --------------------
function safeNumber(value, defaultValue = 0) {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

// --------------------
// Process and filter flight options
// --------------------
function processFlights(flightsData, maxResults = 3) {
  const bestFlights = flightsData?.best_flights || [];
  const otherFlights = flightsData?.other_flights || [];
  const allFlights = [...bestFlights, ...otherFlights];
  
  if (allFlights.length === 0) {
    console.warn("[Budget Agent] No flights found in API response");
    return [];
  }

  return allFlights.slice(0, maxResults).map(flight => {
    const firstFlight = flight.flights?.[0] || {};
    const lastFlight = flight.flights?.[flight.flights?.length - 1] || {};
    
    return {
      airline: firstFlight.airline || "Unknown Airline",
      flightNumber: firstFlight.flight_number || "N/A",
      departure: firstFlight.departure_airport?.time || "N/A",
      arrival: lastFlight.arrival_airport?.time || "N/A",
      duration: safeNumber(flight.total_duration, 0),
      stops: Math.max(0, (flight.flights?.length || 1) - 1),
      price: safeNumber(flight.price, 500), // fallback to $500
      currency: flight.currency || "USD",
      carbonEmissions: safeNumber(flight.carbon_emissions?.this_flight, 0),
    };
  });
}

// --------------------
// Process and filter hotel options
// --------------------
function processHotels(hotelsData, maxResults = 3) {
  const hotels = hotelsData?.properties || [];
  
  if (hotels.length === 0) {
    console.warn("[Budget Agent] No hotels found in API response");
    return [];
  }

  return hotels.slice(0, maxResults).map(hotel => {
    const pricePerNight = safeNumber(
      hotel.rate_per_night?.lowest || 
      hotel.rate_per_night?.extracted_lowest,
      100 // fallback to $100/night
    );
    
    const totalPrice = safeNumber(
      hotel.total_rate?.lowest || 
      hotel.total_rate?.extracted_lowest,
      pricePerNight * 3 // estimate 3 nights
    );

    return {
      name: hotel.name || "Unknown Hotel",
      rating: safeNumber(hotel.overall_rating, 3.5),
      reviewCount: safeNumber(hotel.reviews, 0),
      pricePerNight,
      totalPrice,
      currency: "USD",
      amenities: (hotel.amenities || []).slice(0, 5),
      location: hotel.nearby_places?.[0]?.name || "City Center",
      checkIn: hotel.check_in_time || "3:00 PM",
      checkOut: hotel.check_out_time || "11:00 AM",
    };
  });
}

// --------------------
// Calculate budget breakdown
// --------------------
function calculateBudget(flights, hotels, adults, tripDuration) {
  // Use cheapest options or reasonable defaults
  const cheapestFlight = flights.length > 0 ? flights[0] : null;
  const cheapestHotel = hotels.length > 0 ? hotels[0] : null;

  const flightCost = cheapestFlight ? safeNumber(cheapestFlight.price * adults, 1000) : 1000;
  const hotelCost = cheapestHotel ? safeNumber(cheapestHotel.totalPrice, 300) : 300;
  const estimatedFood = tripDuration * adults * 50;
  const estimatedLocal = tripDuration * 30;
  const miscellaneous = Math.round((flightCost + hotelCost) * 0.1);

  const totalEstimate = Math.round(flightCost + hotelCost + estimatedFood + estimatedLocal + miscellaneous);

  return {
    breakdown: {
      flights: Math.round(flightCost),
      accommodation: Math.round(hotelCost),
      food: Math.round(estimatedFood),
      localTransport: Math.round(estimatedLocal),
      miscellaneous,
    },
    total: totalEstimate,
    perPerson: Math.round(totalEstimate / adults),
    currency: cheapestFlight?.currency || "USD",
  };
}

// --------------------
// Main execute function
// --------------------
async function budgetExecute(args) {
  const { tripId, airline, maxBudget } = BudgetArgs.parse(args);

  // 1. Fetch trip
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new Error("Trip not found");

  const adults = trip.adults || 1;
  const tripDuration = Math.max(1, Math.ceil(
    (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
  ));

  // 2. Get kgmid codes
  console.log(`[Budget Agent] Fetching location codes for ${trip.origin} → ${trip.destination}`);
  const departureKgmid = await fetchKgmid(trip.origin);
  const arrivalKgmid = await fetchKgmid(trip.destination);

  // 3. Fetch flights & hotels
  console.log(`[Budget Agent] Searching flights and hotels...`);
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

  // 4. Process options (top 3 each)
  const topFlights = processFlights(flightsData, 3);
  const topHotels = processHotels(hotelsData, 3);

  console.log(`[Budget Agent] Found ${topFlights.length} flights, ${topHotels.length} hotels`);

  // 5. Calculate budget
  const budget = calculateBudget(topFlights, topHotels, adults, tripDuration);

  // Ensure we have a valid total
  if (isNaN(budget.total) || budget.total <= 0) {
    throw new Error("Failed to calculate valid budget estimate");
  }

  // 6. Check budget constraint
  const withinBudget = maxBudget ? budget.total <= maxBudget : true;
  const budgetStatus = withinBudget ? "Within Budget" : "Over Budget";

  // 7. Store in database with proper relation
  await prisma.budgetItem.create({
    data: {
      trip: {
        connect: { id: trip.id }
      },
      category: "Travel + Accommodation",
      item_name: "Estimated Trip Cost",
      estimated_amount: budget.total,
      actual_amount: 0,
      status: "Pending",
    },
  });

  // Store flight options (if available)
  for (const flight of topFlights) {
    try {
      await prisma.flight.create({
        data: {
          trip: {
            connect: { id: trip.id }
          },
          airline: flight.airline,
          flight_number: flight.flightNumber,
          departure_airport: trip.origin,
          arrival_airport: trip.destination,
          departure_time: new Date(flight.departure),
          arrival_time: new Date(flight.arrival),
          price: flight.price,
          booking_url: null,
          is_recommended: topFlights.indexOf(flight) === 0,
        },
      });
    } catch (dbError) {
      console.warn(`[Budget Agent] Failed to store flight: ${dbError.message}`);
    }
  }

  // Store hotel options (if available)
  for (const hotel of topHotels) {
    try {
      await prisma.hotel.create({
        data: {
          trip: {
            connect: { id: trip.id }
          },
          name: hotel.name,
          location: hotel.location,
          price_per_night: hotel.pricePerNight,
          rating: hotel.rating,
          amenities: hotel.amenities,
          booking_url: null,
          is_recommended: topHotels.indexOf(hotel) === 0,
        },
      });
    } catch (dbError) {
      console.warn(`[Budget Agent] Failed to store hotel: ${dbError.message}`);
    }
  }

  console.log(`[Budget Agent] ✅ Budget calculated: ${budget.currency} ${budget.total}`);

  // 8. Return optimized output for UI
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

export const budgetAgent = {
  name: "budgetAgent",
  description: "Finds best flights and hotels, provides cost breakdown and recommendations.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string" },
      airline: { type: "string" },
      maxBudget: { type: "number" },
    },
    required: ["tripId"],
  },
  validate: (args) => BudgetArgs.parse(args),
  execute: budgetExecute,
};
