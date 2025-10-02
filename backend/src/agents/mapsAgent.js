import prisma from "../config/db.js";
import { z } from "zod";

// --------------------
// Input validation
// --------------------
const MapsArgs = z.object({
  tripId: z.string().uuid(),
});

// --------------------
// Fetch route info from OSRM
// --------------------
async function fetchRoute(startCoords, endCoords) {
  // OSRM expects: longitude,latitude
  const coords = `${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}`;

  const url = `http://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM request failed: ${res.statusText}`);

  const data = await res.json();
  if (data.code !== "Ok") throw new Error(`OSRM error: ${data.message || data.code}`);

  const route = data.routes[0];
  return {
    distance_m: route.distance,       // in meters
    duration_s: route.duration,       // in seconds
    geometry: route.geometry,         // GeoJSON LineString
  };
}

// --------------------
// Execute agent
// --------------------
async function mapsExecute(args) {
  const { tripId } = MapsArgs.parse(args);

  // Fetch trip from DB
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new Error("Trip not found");

  // Extract coordinates
  const startCoords = [trip.origin_coords.lng, trip.origin_coords.lat];
  const endCoords = [trip.destination_coords.lng, trip.destination_coords.lat];

  // Fetch route from OSRM
  const routeData = await fetchRoute(startCoords, endCoords);

  // Save route in database
  await prisma.route.create({
    data: {
      trip_id: trip.id,
      from_location: trip.origin,
      to_location: trip.destination,
      transport_mode: "driving",
      distance_km: routeData.distance_m / 1000,
      duration_minutes: routeData.duration_s / 60,
      route_data: routeData.geometry,
    },
  });

  return {
    summary: `Route calculated from ${trip.origin} to ${trip.destination}`,
    route: routeData,
  };
}

// --------------------
// Export agent
// --------------------
export const mapsAgent = {
  name: "mapsAgent",
  description:
    "Calculates routes, distances, and travel times between origin and destination using OSRM.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string", description: "Trip UUID" },
    },
    required: ["tripId"],
  },
  validate: (args) => MapsArgs.parse(args),
  execute: mapsExecute,
};
