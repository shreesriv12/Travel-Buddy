import { getJson } from "serpapi";
import { z } from "zod";
import prisma from "../config/db.js";

// --------------------
// Argument schema
// --------------------
const TrainArgs = z.object({
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tripId: z.string(),
  adults: z.number().int().min(1).max(10).default(1),
  currency: z.string().default("USD")
});

// --------------------
// City to Coordinates Mapping
// --------------------
const CITY_TO_COORDS = {
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'bangalore': { lat: 12.9716, lng: 77.5946 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'kolkata': { lat: 22.5726, lng: 88.3639 },
  'hyderabad': { lat: 17.3850, lng: 78.4867 },
  'pune': { lat: 18.5204, lng: 73.8567 },
  'ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'lucknow': { lat: 26.8467, lng: 80.9462 },
  
  'new york': { lat: 40.7128, lng: -74.0060 },
  'london': { lat: 51.5074, lng: -0.1278 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
};

// --------------------
// Get coordinates for city
// --------------------
function getCoordinates(city) {
  const normalized = city.toLowerCase().trim();
  return CITY_TO_COORDS[normalized] || { lat: 0, lng: 0 };
}

// --------------------
// Process train data from API response
// --------------------
function processTrainData(response, origin, destination, currency) {
  const directions = response.directions || [];
  
  // Filter for transit directions that include trains
  const trainDirections = directions.filter(direction => {
    if (direction.travel_mode !== "Transit") return false;
    
    // Check if any trip in this direction is a train
    const trips = direction.trips || [];
    return trips.some(trip => {
      const service = trip.service_run_by?.name || '';
      return service.toLowerCase().includes('rail') || 
             service.toLowerCase().includes('train') ||
             trip.travel_mode?.toLowerCase().includes('train');
    });
  });

  const trains = trainDirections.map((direction, index) => {
    const trainTrips = direction.trips?.filter(trip => 
      trip.travel_mode?.toLowerCase().includes('train') ||
      trip.service_run_by?.name?.toLowerCase().includes('rail') ||
      trip.service_run_by?.name?.toLowerCase().includes('train')
    ) || [];

    const firstTrip = trainTrips[0];
    const lastTrip = trainTrips[trainTrips.length - 1];

    return {
      id: `train_${index + 1}`,
      trainName: firstTrip?.service_run_by?.name || 'Express Train',
      trainNumber: `TR${1000 + index}`,
      departureTime: direction.start_time || firstTrip?.start_stop?.time || 'N/A',
      arrivalTime: direction.end_time || lastTrip?.end_stop?.time || 'N/A',
      duration: direction.formatted_duration || 'N/A',
      price: direction.cost || Math.round(500 + Math.random() * 1500), // Fallback pricing
      currency: direction.currency || currency,
      class: "Second AC", // Default class
      bookingLink: firstTrip?.service_run_by?.route_information || null,
      stops: trainTrips.map(trip => ({
        station: trip.start_stop?.name || 'Unknown Station',
        time: trip.start_stop?.time || 'N/A'
      })),
      serviceProvider: firstTrip?.service_run_by?.name || 'Railway Service'
    };
  });

  return trains;
}

// --------------------
// Generate fallback train data
// --------------------
function generateFallbackTrainData(origin, destination, date, currency) {
  const trainTypes = [
    { name: "Rajdhani Express", class: "First AC", basePrice: 2500, speed: "Superfast" },
    { name: "Shatabdi Express", class: "Chair Car", basePrice: 1200, speed: "Fast" },
    { name: "Duronto Express", class: "Sleeper", basePrice: 800, speed: "Express" },
    { name: "Mail Express", class: "Second Sitting", basePrice: 400, speed: "Mail" }
  ];

  return trainTypes.map((train, index) => ({
    id: `fallback_train_${index + 1}`,
    trainName: train.name,
    trainNumber: `TR${2000 + index}`,
    departureTime: `${8 + index * 3}:00`,
    arrivalTime: `${14 + index * 3}:00`,
    duration: `${6 + index} hours`,
    price: train.basePrice,
    currency: currency,
    class: train.class,
    bookingLink: null,
    stops: [
      { station: `${origin} Central`, time: `${8 + index * 3}:00` },
      { station: "Intermediate Station", time: `${10 + index * 3}:00` },
      { station: `${destination} Junction`, time: `${14 + index * 3}:00` }
    ],
    serviceProvider: "Indian Railways",
    type: train.speed,
    fallback: true
  }));
}

// --------------------
// Main execute function
// --------------------
async function trainExecute(args) {
  const { origin, destination, departureDate, tripId, adults, currency } = TrainArgs.parse(args);

  console.log(`[TrainAgent] Starting train search for Trip ID: ${tripId}`);
  console.log(`[TrainAgent] From ${origin} to ${destination} on ${departureDate}`);

  try {
    // Get coordinates for origin/destination
    const originCoords = getCoordinates(origin);
    const destCoords = getCoordinates(destination);

    if (originCoords.lat === 0 || destCoords.lat === 0) {
      console.warn(`[TrainAgent] Coordinates not found for ${origin} or ${destination}, using address search`);
      // Fall back to address-based search
      const requestParams = {
        engine: "google_maps_directions",
        start_addr: origin,
        end_addr: destination,
        travel_mode: 3, // Transit mode
        prefer: "train", // Prefer trains
        hl: "en",
        gl: "in", // India focus
        api_key: process.env.SERPAPI_KEY, // CRITICAL: Add api_key parameter
      };

      console.log("[TrainAgent] Sending request to SerpApi with addresses");
      
      const response = await new Promise((resolve, reject) => {
        getJson(requestParams, (result) => {
          if (!result) {
            reject(new Error("No response from SerpApi"));
            return;
          }
          if (result.error) {
            reject(new Error(result.error));
            return;
          }
          resolve(result);
        });
      });

      console.log(`[TrainAgent] Received response from SerpApi`);

      // Process the train data
      const trains = processTrainData(response, origin, destination, currency);

      const result = {
        summary: `Found ${trains.length} train options from ${origin} to ${destination} on ${departureDate}.`,
        trains: trains,
        searchParams: {
          origin,
          destination,
          departureDate,
          adults,
          currency,
        },
        dataSource: "SerpApi"
      };

      // Store in DB
      if (tripId) {
        await prisma.trip.update({
          where: { id: tripId },
          data: { trains_data: result },
        });
        console.log(`[TrainAgent] Saved train data to trip ${tripId}.`);
      }

      return result;
    }

    // Use coordinates-based search if coordinates are available
    const departTimestamp = new Date(departureDate).getTime();
    
    const requestParams = {
      engine: "google_maps_directions",
      start_coords: `${originCoords.lat},${originCoords.lng}`,
      end_coords: `${destCoords.lat},${destCoords.lng}`,
      travel_mode: 3, // Transit mode
      prefer: "train", // Prefer trains
      time: `depart_at:${departTimestamp}`,
      hl: "en",
      gl: "in",
      api_key: process.env.SERPAPI_KEY, // CRITICAL: Add api_key parameter
    };

    console.log("[TrainAgent] Sending request to SerpApi with coordinates");

    const response = await new Promise((resolve, reject) => {
      getJson(requestParams, (result) => {
        if (!result) {
          reject(new Error("No response from SerpApi"));
          return;
        }
        if (result.error) {
          reject(new Error(result.error));
          return;
        }
        resolve(result);
      });
    });

    console.log(`[TrainAgent] Received response from SerpApi`);

    // Process the train data
    const trains = processTrainData(response, origin, destination, currency);

    const result = {
      summary: `Found ${trains.length} train options from ${origin} to ${destination} on ${departureDate}.`,
      trains: trains,
      searchParams: {
        origin,
        destination,
        departureDate,
        adults,
        currency,
      },
      dataSource: "SerpApi"
    };

    // Store in DB
    if (tripId) {
      await prisma.trip.update({
        where: { id: tripId },
        data: { trains_data: result },
      });
      console.log(`[TrainAgent] Saved train data to trip ${tripId}.`);
    }

    return result;

  } catch (err) {
    console.error("[TrainAgent] Error:", err.message);
    
    // Generate fallback data
    const fallbackTrains = generateFallbackTrainData(origin, destination, departureDate, currency);
    
    const errorResult = {
      summary: `Using simulated train data for ${origin} to ${destination}. Original error: ${err.message}`,
      trains: fallbackTrains,
      searchParams: { 
        origin, 
        destination, 
        departureDate, 
        adults, 
        currency 
      },
      error: err.message,
      fallback: true
    };

    if (tripId) {
      await prisma.trip.update({
        where: { id: tripId },
        data: { trains_data: errorResult },
      }).catch(e => console.error("Failed to update trip with train error:", e));
    }

    return errorResult;
  }
}

// --------------------
// Export agent
// --------------------
export const trainAgent = {
  name: "trainAgent",
  description: "Fetches train options between cities using SerpApi Google Maps Directions with transit mode.",
  jsonSchema: {
    type: "object",
    properties: {
      origin: { 
        type: "string", 
        description: "Origin city name" 
      },
      destination: { 
        type: "string", 
        description: "Destination city name" 
      },
      departureDate: { 
        type: "string", 
        description: "Departure date in YYYY-MM-DD format" 
      },
      tripId: { 
        type: "string", 
        description: "Trip ID to store the data for" 
      },
      adults: { 
        type: "integer", 
        description: "Number of adults (default: 1)" 
      },
      currency: { 
        type: "string", 
        description: "Currency code (default: USD)" 
      },
    },
    required: ["origin", "destination", "departureDate", "tripId"],
  },
  validate: (args) => TrainArgs.parse(args),
  execute: trainExecute,
};