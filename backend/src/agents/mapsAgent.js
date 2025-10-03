import prisma from "../config/db.js";
import { z } from "zod";
import axios from "axios";

// --------------------
// Zod validation schema
// --------------------
const RouteArgs = z.object({
  tripId: z.string().uuid(),
  mode: z.enum(["driving", "walking", "bicycling"]).optional(), // OSRM supported modes
});

// --------------------
// Route execution function
// --------------------
async function routeExecute(args) {
  const { tripId } = RouteArgs.parse(args);
  let { mode = "driving" } = args;

  // Fetch trip and coordinates from DB
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      origin: true,
      origin_coords: true,
      destination: true,
      destination_coords: true,
    },
  });

  if (!trip) throw new Error(`Trip with id ${tripId} not found.`);

  const { origin, origin_coords, destination, destination_coords } = trip;

  if (!origin_coords || !destination_coords) {
    throw new Error(`Coordinates for ${origin} or ${destination} are missing in the DB.`);
  }

  const originCoords = {
    lat: origin_coords.lat ?? origin_coords.latitude,
    lon: origin_coords.lng ?? origin_coords.longitude,
  };

  const destinationCoords = {
    lat: destination_coords.lat ?? destination_coords.latitude,
    lon: destination_coords.lng ?? destination_coords.longitude,
  };

  try {
    // OSRM profile
    const profile = mode === "walking" ? "foot" : mode === "bicycling" ? "bike" : "car";

    // Fetch route from OSRM
    const res = await axios.get(
      `http://router.project-osrm.org/route/v1/${profile}/${originCoords.lon},${originCoords.lat};${destinationCoords.lon},${destinationCoords.lat}`,
      {
        params: {
          overview: "full",
          geometries: "geojson",
          steps: true,
        },
      }
    );

    const route = res.data.routes?.[0];
    const leg = route?.legs?.[0];

    if (!leg) {
      console.warn(`[OSRM Tool] No route found from ${origin} to ${destination}`);
      return { distance: 0, duration: 0, steps: [] };
    }

    // Calculate distance and estimated cost
    const distanceKm = leg.distance / 1000;
    const costEstimate = mode === "driving" ? Math.round(distanceKm / 15) : 0;

    // Save route in DB
    const routeRecord = await prisma.route.create({
      data: {
        trip_id: tripId,
        from_location: origin,
        to_location: destination,
        transport_mode: mode,
        distance_km: distanceKm,
        duration_minutes: Math.round(leg.duration / 60),
        estimated_cost: costEstimate,
        route_data: leg,
      },
    });

    // Return structured route
    return {
      id: routeRecord.id,
      origin,
      destination,
      mode,
      distance: routeRecord.distance_km,
      duration: routeRecord.duration_minutes,
      estimated_cost: routeRecord.estimated_cost,
      steps: leg.steps.map((s, idx) => ({
        step_number: idx + 1,
        instruction: s.maneuver.instruction || "Follow the road",
        distance: `${(s.distance / 1000).toFixed(2)} km`,
        duration: `${Math.round(s.duration / 60)} min`,
        type: s.maneuver.type,
        modifier: s.maneuver.modifier || null,
        location: { lat: s.maneuver.location[1], lon: s.maneuver.location[0] },
      })),
      geometry: route.geometry,
    };
  } catch (err) {
    console.error("[OSRM Tool Error]", err.message || err);
    throw err;
  }
}

// --------------------
// Exported mapsAgent
// --------------------
export const mapsAgent = {
  name: "mapsTool",
  description:
    "Fetches route, travel distance, estimated duration, and estimated cost between two places using OSRM and trip coordinates from the database.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string" },
      mode: { type: "string", enum: ["driving", "walking", "bicycling"] },
    },
    required: ["tripId"],
  },
  validate: (args) => RouteArgs.parse(args),
  execute: routeExecute,
};
