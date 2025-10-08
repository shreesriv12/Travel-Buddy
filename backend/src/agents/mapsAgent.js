// mapsAgent.js
import { Client } from "@googlemaps/google-maps-services-js";
import { z } from "zod";
import prisma from "../config/db.js";

// --------------------
// Zod validation schema
// --------------------
const MapsArgs = z.object({
  tripId: z.string().uuid(),
  action: z.enum(["directions", "nearby", "place_details", "distance_matrix"]).default("directions"),
  mode: z.enum(["driving", "walking", "transit", "bicycling"]).optional().default("driving"),
  placeType: z.string().optional(),
});

// --------------------
// Google Maps Client
// --------------------
const client = new Client({});

// --------------------
// Main execution function
// --------------------
async function mapsExecute(args) {
  const { tripId, action, mode, placeType } = MapsArgs.parse(args);

  console.log(`[MapsAgent] 🚀 Executing action: ${action || 'directions'}`);

  // Fetch trip data from DB
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      origin: true,
      destination: true,
      origin_coords: true,
      destination_coords: true,
      start_date: true,
    },
  });

  if (!trip) throw new Error(`Trip with id ${tripId} not found.`);

  const { origin, destination } = trip;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  console.log(`[MapsAgent] Processing: ${origin} → ${destination}`);

  // ✅ Let errors propagate to orchestrator - no fallback here
  switch (action) {
    case "directions":
      return await getDirections(origin, destination, mode, tripId, apiKey);
    case "nearby":
      return await getNearbyPlaces(destination, placeType, tripId, apiKey);
    case "place_details":
      return await getPlaceDetails(destination, tripId, apiKey);
    case "distance_matrix":
      return await getDistanceMatrix(origin, destination, mode, tripId, apiKey);
    default:
      return await getDirections(origin, destination, mode, tripId, apiKey);
  }
}

// --------------------
// Directions Function
// --------------------
async function getDirections(origin, destination, mode, tripId, apiKey) {
  try {
    console.log('[MapsAgent] 📍 Calling Google Directions API...');
    
    const response = await client.directions({
      params: { origin, destination, mode, key: apiKey },
      timeout: 10000,
    });

    console.log("[MapsAgent] API response status:", response.data.status);

    if (response.data.status !== 'OK') {
      throw new Error(`Directions API error: ${response.data.status}`);
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];

    const distanceKm = leg.distance.value / 1000;
    const durationMinutes = Math.round(leg.duration.value / 60);
    const costEstimate = calculateCostEstimate(distanceKm, durationMinutes, mode);

    const steps = leg.steps.map((step, idx) => ({
      step_number: idx + 1,
      instruction: cleanHtmlInstructions(step.html_instructions),
      distance: step.distance.text,
      duration: step.duration.text,
      type: step.travel_mode,
      coordinates: step.start_location,
    }));

    // ✅ Serialize to avoid circular references
    const fullResponseData = JSON.parse(JSON.stringify(response.data));
    
    console.log('[MapsAgent] 💾 Saving route to database...');

    // Save route with full response
    const routeRecord = await prisma.route.create({
      data: {
        trip_id: tripId,
        from_location: origin,
        to_location: destination,
        transport_mode: mode,
        distance_km: distanceKm,
        duration_minutes: durationMinutes,
        estimated_cost: costEstimate,
        route_data: {
          overview_polyline: route.overview_polyline,
          bounds: route.bounds,
          warnings: route.warnings || [],
          waypoint_order: route.waypoint_order || [],
        },
        full_response: fullResponseData,
      },
    });

    console.log('[MapsAgent] ✅ Route saved successfully - ID:', routeRecord.id);

    return {
      id: routeRecord.id,
      origin,
      destination,
      mode,
      distance: distanceKm,
      duration: durationMinutes,
      estimated_cost: costEstimate,
      steps,
      summary: `Route from ${origin} to ${destination}: ${distanceKm.toFixed(1)} km, ${durationMinutes} min via ${mode}`,
      polyline: route.overview_polyline,
    };
  } catch (error) {
    console.error('[MapsAgent] ❌ Directions error:', error.message);
    throw error; // ✅ Propagate error, don't create fallback
  }
}

// ... rest of your functions remain the same ...

// --------------------
// Helper Functions
// --------------------
function cleanHtmlInstructions(html) { 
  return html ? html.replace(/<[^>]*>/g, '').trim() : "Continue"; 
}

function calculateCostEstimate(distanceKm, durationMinutes, mode) {
  const rates = { driving: distanceKm*12, transit: distanceKm*2, walking:0, bicycling:0 };
  return Math.round(rates[mode] || distanceKm*8);
}

function calculateRelevanceScore(place) {
  let score = 0; 
  if (place.rating>=4.5) score+=30; 
  else if (place.rating>=4) score+=20; 
  else if(place.rating>=3.5) score+=10;
  if(place.total_ratings>1000) score+=20; 
  else if(place.total_ratings>100) score+=10;
  return Math.min(score,50);
}

// ❌ REMOVE THESE FALLBACK FUNCTIONS - They're causing the issue
// function createFallbackResponse(...) { ... }
// function getHardcodedRouteData(...) { ... }

// --------------------
// Exported mapsAgent
// --------------------
export const mapsAgent = {
  name: "mapsTool",
  description: "Comprehensive Google Maps integration for directions, nearby places, and route planning",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string" },
      action: { type: "string", enum: ["directions","nearby","place_details","distance_matrix"] },
      mode: { type: "string", enum: ["driving","walking","transit","bicycling"] },
      placeType: { type: "string" },
    },
    required: ["tripId"],
  },
  validate: args => MapsArgs.parse(args),
  execute: mapsExecute,
};