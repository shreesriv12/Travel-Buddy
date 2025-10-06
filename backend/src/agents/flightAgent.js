import { getJson } from "serpapi";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// --------------------
// Argument schema
// --------------------
const FlightArgs = z.object({
  origin: z.string(), // kgmid for origin
  destination: z.string(), // kgmid for destination
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  adults: z.number().int().min(1).max(10).default(1),
  children: z.number().int().min(0).max(10).default(0),
  currency: z.string().default("INR")
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
// Convert IATA to kgmid if needed
// --------------------
async function resolveLocation(input) {
  // If it's already a kgmid (starts with /g/), return as is
  if (input.startsWith('/g/')) {
    return input;
  }
  
  // If it's an IATA code (3 letters), treat it as airport and get kgmid
  if (/^[A-Z]{3}$/.test(input)) {
    return fetchKgmid(`${input} airport`);
  }
  
  // Otherwise treat as city name and get kgmid
  return fetchKgmid(input);
}

// --------------------
// Main execute function
// --------------------
async function flightExecute(args) {
  const { origin, destination, departureDate, returnDate, adults, children, currency } = FlightArgs.parse(args);

  try {
    // Resolve locations to kgmid codes
    console.log(`[FlightAgent] Resolving origin: ${origin}`);
    const departureKgmid = await resolveLocation(origin);
    
    console.log(`[FlightAgent] Resolving destination: ${destination}`);
    const arrivalKgmid = await resolveLocation(destination);
    
    console.log(`[FlightAgent] Using kgmid codes - departure: ${departureKgmid}, arrival: ${arrivalKgmid}`);

    const response = await getJson({
      engine: "google_flights",
      departure_id: departureKgmid,
      arrival_id: arrivalKgmid,
      outbound_date: departureDate,
      return_date: returnDate,
      adults,
      children,
      currency,
      api_key: process.env.SERPAPI_KEY,
    });

    // Process best flights with multiple flight segments
    const flights = response.best_flights?.map(flight => ({
      airline: flight.flights.map(f => f.airline).join(' + '),
      flightNumbers: flight.flights.map(f => f.flight_number).join(' + '),
      departureTime: flight.flights[0]?.departure_airport?.time,
      arrivalTime: flight.flights[flight.flights.length - 1]?.arrival_airport?.time,
      duration: flight.total_duration || flight.flights[0]?.duration,
      stops: flight.flights.length - 1,
      price: flight.price,
      bookingLink: flight.booking_link,
      airlines: flight.flights.map(f => f.airline),
      flightSegments: flight.flights.map(segment => ({
        airline: segment.airline,
        flightNumber: segment.flight_number,
        departure: {
          airport: segment.departure_airport?.name,
          time: segment.departure_airport?.time
        },
        arrival: {
          airport: segment.arrival_airport?.name,
          time: segment.arrival_airport?.time
        },
        duration: segment.duration
      }))
    })) || [];

    // Also include other flight options
    const otherFlights = response.other_flights?.map(flight => ({
      airline: flight.flights.map(f => f.airline).join(' + '),
      flightNumbers: flight.flights.map(f => f.flight_number).join(' + '),
      departureTime: flight.flights[0]?.departure_airport?.time,
      arrivalTime: flight.flights[flight.flights.length - 1]?.arrival_airport?.time,
      duration: flight.total_duration || flight.flights[0]?.duration,
      stops: flight.flights.length - 1,
      price: flight.price,
      bookingLink: flight.booking_link
    })) || [];

    return {
      summary: `Found ${flights.length} best flight options and ${otherFlights.length} other options from ${origin} to ${destination}.`,
      bestFlights: flights,
      otherFlights: otherFlights,
      searchParams: {
        origin: departureKgmid,
        destination: arrivalKgmid,
        departureDate,
        returnDate,
        adults,
        children,
        currency
      },
      raw: response
    };
  } catch (err) {
    console.error("FlightAgent Error:", err);
    throw new Error(`Failed to fetch flights: ${err.message}`);
  }
}

// --------------------
// Export agent
// --------------------
export const flightAgent = {
  name: "flightAgent",
  description: "Fetches best flight options between origin and destination using city names, IATA codes, or kgmid codes",
  jsonSchema: {
    type: "object",
    properties: {
      origin: { 
        type: "string", 
        description: "Origin city name, IATA airport code, or kgmid (e.g. 'New York', 'JFK', or '/g/11b7...')" 
      },
      destination: { 
        type: "string", 
        description: "Destination city name, IATA airport code, or kgmid (e.g. 'London', 'LHR', or '/g/11c8...')" 
      },
      departureDate: { 
        type: "string", 
        description: "Outbound date in YYYY-MM-DD" 
      },
      returnDate: { 
        type: "string", 
        description: "Optional return date in YYYY-MM-DD" 
      },
      adults: { 
        type: "integer", 
        description: "Number of adults (default: 1)" 
      },
      children: { 
        type: "integer", 
        description: "Number of children (default: 0)" 
      },
      currency: {
        type: "string",
        description: "Currency code (default: INR)"
      }
    },
    required: ["origin", "destination", "departureDate"]
  },
  validate: (args) => FlightArgs.parse(args),
  execute: flightExecute
};