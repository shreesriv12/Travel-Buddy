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

  console.log(`[MapsAgent] Executing ${action} from ${origin} to ${destination}`);

  try {
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
  } catch (error) {
    console.error("[MapsAgent Error]", error.message);
    return createFallbackResponse(origin, destination, mode, tripId, error.message);
  }
}

// --------------------
// Directions Function
// --------------------
async function getDirections(origin, destination, mode, tripId, apiKey) {
  try {
    const response = await client.directions({
      params: { origin, destination, mode, key: apiKey },
      timeout: 10000,
    });

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
          warnings: route.warnings,
          waypoint_order: route.waypoint_order,
        },
        full_response: response.data, // store full API JSON
      },
    });

    console.log('[MapsAgent] Saved Route:', routeRecord);

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
    console.error('[MapsAgent] Directions error:', error.response?.data || error.message);
    throw error;
  }
}

// --------------------
// Nearby Places Function
// --------------------
async function getNearbyPlaces(location, placeType = 'tourist_attraction', tripId, apiKey) {
  try {
    const geocodeResponse = await client.geocode({ params: { address: location, key: apiKey } });
    if (geocodeResponse.data.status !== 'OK') throw new Error(`Geocoding error: ${geocodeResponse.data.status}`);
    const coordinates = geocodeResponse.data.results[0].geometry.location;

    const placesResponse = await client.placesNearby({ params: { location: coordinates, radius: 5000, type: placeType, key: apiKey } });
    if (placesResponse.data.status !== 'OK') throw new Error(`Places API error: ${placesResponse.data.status}`);

    const places = await Promise.all(
      placesResponse.data.results.slice(0, 10).map(async (place) => {
        const details = await getPlaceDetailsById(place.place_id, apiKey);
        return {
          name: place.name,
          address: place.vicinity,
          rating: place.rating,
          total_ratings: place.user_ratings_total,
          types: place.types,
          place_id: place.place_id,
          coordinates: place.geometry?.location,
          ...details,
        };
      })
    );

    // Save events with full API response
    const eventRecords = await Promise.all(
      places.map((place, idx) => 
        prisma.event.create({
          data: {
            trip_id: tripId,
            title: place.name,
            description: `Rating: ${place.rating}/5 • ${place.total_ratings} reviews`,
            location: place.address,
            category: place.types?.[0] || 'attraction',
            price: 0,
            is_recommended: place.rating >= 4.0,
            relevance_score: calculateRelevanceScore(place),
            full_response: placesResponse.data.results[idx], // store full Google place JSON
          },
        })
      )
    );

    console.log('[MapsAgent] Saved Events:', eventRecords);

    return {
      location,
      coordinates,
      places: places.map((place, idx) => ({ ...place, db_id: eventRecords[idx].id })),
      summary: `Found ${places.length} ${placeType} places near ${location}`,
    };
  } catch (error) {
    console.error('[MapsAgent] Nearby places error:', error.response?.data || error.message);
    throw error;
  }
}

// --------------------
// Place Details Function
// --------------------
async function getPlaceDetailsById(placeId, apiKey) {
  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: ['name','formatted_address','rating','user_ratings_total','photos','opening_hours','website','formatted_phone_number','price_level','types'],
        key: apiKey,
      },
    });
    if (response.data.status !== 'OK') throw new Error(`Place details error: ${response.data.status}`);
    const result = response.data.result;

    let photoUrl = null;
    if (result.photos && result.photos.length > 0) photoUrl = await getPlacePhoto(result.photos[0].photo_reference, apiKey);

    return {
      formatted_address: result.formatted_address,
      phone: result.formatted_phone_number,
      website: result.website,
      opening_hours: result.opening_hours,
      price_level: result.price_level,
      photo_url: photoUrl,
    };
  } catch (error) {
    console.error('[MapsAgent] Place details error:', error.message);
    return {};
  }
}

// --------------------
// Place Photo Function
// --------------------
async function getPlacePhoto(photoReference, apiKey) {
  try {
    const response = await client.placePhoto({ params: { photoreference: photoReference, maxwidth: 400, key: apiKey } });
    return response.request?.res?.responseUrl || null;
  } catch (error) {
    console.error('[MapsAgent] Photo error:', error.message);
    return null;
  }
}

// --------------------
// Distance Matrix Function
// --------------------
async function getDistanceMatrix(origin, destination, mode, tripId, apiKey) {
  try {
    const response = await client.distancematrix({ params: { origins: [origin], destinations: [destination], mode, key: apiKey } });
    if (response.data.status !== 'OK') throw new Error(`Distance Matrix error: ${response.data.status}`);

    const element = response.data.rows[0].elements[0];
    if (element.status !== 'OK') throw new Error(`Distance Matrix element error: ${element.status}`);

    const distanceKm = element.distance.value / 1000;
    const durationMinutes = Math.round(element.duration.value / 60);

    return {
      origin,
      destination,
      mode,
      distance: distanceKm,
      duration: durationMinutes,
      distance_text: element.distance.text,
      duration_text: element.duration.text,
      summary: `Distance: ${element.distance.text}, Duration: ${element.duration.text} via ${mode}`,
    };
  } catch (error) {
    console.error('[MapsAgent] Distance matrix error:', error.response?.data || error.message);
    throw error;
  }
}

// --------------------
// Helper Functions
// --------------------
function cleanHtmlInstructions(html) { return html ? html.replace(/<[^>]*>/g, '').trim() : "Continue"; }
function calculateCostEstimate(distanceKm, durationMinutes, mode) {
  const rates = { driving: distanceKm*12, transit: distanceKm*2, walking:0, bicycling:0 };
  return Math.round(rates[mode] || distanceKm*8);
}
function calculateRelevanceScore(place) {
  let score = 0; if (place.rating>=4.5) score+=30; else if (place.rating>=4) score+=20; else if(place.rating>=3.5) score+=10;
  if(place.total_ratings>1000) score+=20; else if(place.total_ratings>100) score+=10;
  return Math.min(score,50);
}
function createFallbackResponse(origin,destination,mode,tripId,error){
  const fallbackData=getHardcodedRouteData(origin,destination,mode);
  return {...fallbackData, origin,destination,mode,error,fallback:true};
}
function getHardcodedRouteData(origin,destination,mode){
  const commonRoutes={'Delhi to Mumbai':{distance:1400,duration:1140},'Mumbai to Delhi':{distance:1400,duration:1140},'Delhi to Bangalore':{distance:2150,duration:1740},'Bangalore to Delhi':{distance:2150,duration:1740},'Mumbai to Bangalore':{distance:1000,duration:900}};
  const routeData=commonRoutes[`${origin} to ${destination}`]||{distance:500,duration:300};
  const cost=calculateCostEstimate(routeData.distance,routeData.duration,mode);
  return {distance:routeData.distance,duration:routeData.duration,cost,steps:[{step_number:1,instruction:`Start from ${origin}`,distance:"0 km",duration:"0 min",type:"departure"},{step_number:2,instruction:`Travel to ${destination}`,distance:`${routeData.distance} km`,duration:`${routeData.duration} min`,type:"travel"},{step_number:3,instruction:`Arrive at ${destination}`,distance:"0 km",duration:"0 min",type:"arrival"}],summary:`Fallback route from ${origin} to ${destination}: ${routeData.distance} km, ${routeData.duration} min via ${mode}`};
}

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
