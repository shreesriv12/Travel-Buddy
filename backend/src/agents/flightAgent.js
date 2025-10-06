import { getJson } from "serpapi";
import { z } from "zod";

// --------------------
// Argument schema
// --------------------
const FlightArgs = z.object({
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  adults: z.number().int().min(1).max(10).default(1),
  children: z.number().int().min(0).max(10).default(0),
  currency: z.string().default("USD")
});

// --------------------
// City to Airport Code Mapping
// --------------------
const CITY_TO_AIRPORT = {
  // Indian cities
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
  
  // International cities
  'new york': 'JFK',
  'london': 'LHR',
  'paris': 'CDG',
  'dubai': 'DXB',
  'singapore': 'SIN',
  'bangkok': 'BKK',
  'tokyo': 'NRT',
  'sydney': 'SYD',
  'toronto': 'YYZ',
  'frankfurt': 'FRA'
};

// --------------------
// Convert city name to airport code
// --------------------
function cityToAirportCode(cityName) {
  const normalized = cityName.toLowerCase().trim();
  return CITY_TO_AIRPORT[normalized] || 'DEL'; // Default to Delhi if not found
}

// --------------------
// Main execute function
// --------------------
async function flightExecute(args) {
  const { origin, destination, departureDate, returnDate, adults, children, currency } = FlightArgs.parse(args);

  try {
    console.log(`[FlightAgent] Converting cities to airport codes...`);
    
    // Convert city names to airport codes
    const departureCode = cityToAirportCode(origin);
    const arrivalCode = cityToAirportCode(destination);
    
    console.log(`[FlightAgent] Searching flights: ${departureCode} → ${arrivalCode} on ${departureDate}`);

    const response = await new Promise((resolve, reject) => {
      getJson({
        engine: "google_flights",
        departure_id: departureCode,
        arrival_id: arrivalCode,
        outbound_date: departureDate,
        return_date: returnDate,
        adults,
        children,
        currency,
        api_key: process.env.SERPAPI_KEY,
      }, (result) => {
        if (!result) {
          reject(new Error("No response from SerpApi"));
          return;
        }
        
        // Check for API errors
        if (result.error) {
          reject(new Error(result.error));
          return;
        }
        
        resolve(result);
      });
    });

    // Process best flights
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

    // Process other flights
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

    return {
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
  } catch (err) {
    console.error("FlightAgent Error:", err.message);
    
    // Return fallback flight data
    const fallbackFlights = [
      {
        airline: "Multiple Airlines",
        flightNumbers: "Check Airlines",
        departureTime: "Morning",
        arrivalTime: "Afternoon", 
        duration: 120,
        stops: 0,
        price: 300,
        currency: currency,
        bookingLink: null,
        flightSegments: []
      }
    ];

    return {
      summary: `Using fallback flight data for ${origin} to ${destination}. Original error: ${err.message}`,
      bestFlights: fallbackFlights,
      otherFlights: [],
      searchParams: {
        origin,
        destination, 
        departureDate,
        returnDate,
        adults,
        children,
        currency
      },
      error: err.message
    };
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
    required: ["origin", "destination", "departureDate"]
  },
  validate: (args) => FlightArgs.parse(args),
  execute: flightExecute
};