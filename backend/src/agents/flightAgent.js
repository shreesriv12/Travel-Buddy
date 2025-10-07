// FlightAgent.js
import { getJson } from "serpapi";
import { z } from "zod";
import { PrismaClient } from '@prisma/client';

// Instantiate the Prisma Client
const prisma = new PrismaClient();

// --------------------
// Argument schema
// --------------------
const FlightArgs = z.object({
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tripId: z.string(),
  adults: z.number().int().min(1).max(10).default(1),
  children: z.number().int().min(0).max(10).default(0),
  currency: z.string().default("USD")
});

// --------------------
// City to Airport Code Mapping
// --------------------
const CITY_TO_AIRPORT = {
  'delhi': 'DEL',
  'mumbai': 'BOM',
  'bangalore': 'BLR',
  'chennai': 'MAA',
  'kolkata': 'CCU',
  'hyderabad': 'HYD',
  'pune': 'PNQ',
  'ahmedabad': 'AMD',
  'jaipur': 'JAI',
  'lucknow': 'LKO',
  'india': 'DEL', // Fallback for the country
  
  'new york': 'JFK',
  'london': 'LHR',
  'paris': 'CDG',
  'dubai': 'DXB',
  'singapore': 'SIN',
  'bangkok': 'BKK',
  'tokyo': 'NRT',
  'sydney': 'SYD',
  'toronto': 'YYZ',
  'frankfurt': 'FRA',
  'usa': 'JFK', // Fallback for the country
  'france': 'CDG', // Fallback for the country
};

// --------------------
// Convert city name to airport code
// --------------------
function cityToAirportCode(cityName) {
  const normalized = cityName.toLowerCase().trim();
  const code = CITY_TO_AIRPORT[normalized];
  return code || null; // Return null if no mapping is found, this is key for debugging
}

// --------------------
// Main execute function
// --------------------
async function flightExecute(args) {
  const { origin, destination, departureDate, returnDate, tripId, adults, children, currency } = FlightArgs.parse(args);

  console.log(`[FlightAgent Debug] Starting flight search for Trip ID: ${tripId}`);
  console.log(`[FlightAgent Debug] Raw inputs: Origin=${origin}, Destination=${destination}, DepartureDate=${departureDate}`);

  try {
    const departureCode = cityToAirportCode(origin);
    const arrivalCode = cityToAirportCode(destination);

    console.log(`[FlightAgent Debug] Converted codes: departureCode=${departureCode}, arrivalCode=${arrivalCode}`);

    // If a valid airport code is not found, throw a specific error
    if (!departureCode || !arrivalCode) {
      const errorMessage = `Invalid or unsupported origin/destination: "${origin}" to "${destination}". Please use a specific city name or airport code (e.g., 'New York', 'Mumbai').`;
      throw new Error(errorMessage);
    }
    
    const requestParams = {
        engine: "google_flights",
        departure_id: departureCode,
        arrival_id: arrivalCode,
        outbound_date: departureDate,
        return_date: returnDate,
        adults,
        children,
        currency,
        api_key: process.env.SERPAPI_KEY,
    };
    
    console.log("[FlightAgent Debug] Sending request to SerpApi with params:", requestParams);
    
    const response = await new Promise((resolve, reject) => {
      getJson(requestParams, (result) => {
        if (!result) {
          reject(new Error("No response from SerpApi"));
          return;
        }
        if (result.error) {
          // Reject with the raw API error for debugging
          reject(new Error(result.error));
          return;
        }
        resolve(result);
      });
    });

    console.log(`[FlightAgent Debug] Received successful response from SerpApi.`);
    
    // Process flights
    const flights = response.best_flights?.map(flight => ({
      airline: flight.flights?.map(f => f.airline).join(' + ') || 'Unknown',
      flightNumbers: flight.flights?.map(f => f.flight_number).join(' + ') || 'N/A',
      departureTime: flight.flights?.[0]?.departure_airport?.time || 'N/A',
      arrivalTime: flight.flights?.[flight.flights?.length - 1]?.arrival_airport?.time || 'N/A',
      duration: flight.total_duration || flight.flights?.[0]?.duration || 0,
      stops: (flight.flights?.length || 1) - 1,
      price: flight.price || 0,
      currency: flight.currency || currency,
      bookingLink: flight.booking_link,
      flightSegments: flight.flights?.map(segment => ({
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
      })) || []
    })) || [];

    const otherFlights = response.other_flights?.map(flight => ({
      airline: flight.flights?.map(f => f.airline).join(' + ') || 'Unknown',
      flightNumbers: flight.flights?.map(f => f.flight_number).join(' + ') || 'N/A',
      departureTime: flight.flights?.[0]?.departure_airport?.time || 'N/A',
      arrivalTime: flight.flights?.[flight.flights?.length - 1]?.arrival_airport?.time || 'N/A',
      duration: flight.total_duration || flight.flights?.[0]?.duration || 0,
      stops: (flight.flights?.length || 1) - 1,
      price: flight.price || 0,
      currency: flight.currency || currency,
      bookingLink: flight.booking_link
    })) || [];

    console.log(`[FlightAgent] Found ${flights.length} best flights and ${otherFlights.length} other flights`);

    const result = {
      summary: `Found ${flights.length} best flight options and ${otherFlights.length} other options from ${origin} (${departureCode}) to ${destination} (${arrivalCode}).`,
      bestFlights: flights,
      otherFlights: otherFlights,
      searchParams: {
        origin: departureCode,
        destination: arrivalCode,
        departureDate,
        returnDate,
        adults,
        children,
        currency
      }
    };
    
    if (tripId) {
      await prisma.trip.update({
        where: { id: tripId },
        data: { flights_data: result },
      });
      console.log(`[FlightAgent] Successfully saved flight data to trip ${tripId}.`);
    }

    return result;

  } catch (err) {
    console.error("FlightAgent Error:", err.message);

    // Instead of fallback, we will just return a structured error
    const errorResult = {
      summary: `Flight search failed. Original error: ${err.message}`,
      bestFlights: [],
      otherFlights: [],
      searchParams: { origin, destination, departureDate, returnDate, adults, children, currency },
      error: err.message
    };
    
    if (tripId) {
      await prisma.trip.update({
        where: { id: tripId },
        data: { flights_data: errorResult },
      }).catch(e => console.error("Failed to update trip with flight error:", e));
    }

    return errorResult;
  }
}

// --------------------
// Export agent
// --------------------
export const flightAgent = {
  name: "flightAgent",
  description: "Fetches flight options between origin and destination using SerpApi with airport code conversion",
  jsonSchema: {
    type: "object",
    properties: {
      origin: {
        type: "string",
        description: "Origin city name (e.g., 'Delhi', 'Mumbai')"
      },
      destination: {
        type: "string",
        description: "Destination city name (e.g., 'Mumbai', 'Bangalore')"
      },
      departureDate: {
        type: "string",
        description: "Outbound date in YYYY-MM-DD"
      },
      returnDate: {
        type: "string",
        description: "Optional return date in YYYY-MM-DD"
      },
      tripId: {
        type: "string",
        description: "The ID of the trip to store the data for"
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
        description: "Currency code (default: USD)"
      }
    },
    required: ["origin", "destination", "departureDate", "tripId"]
  },
  validate: (args) => FlightArgs.parse(args),
  execute: flightExecute
};