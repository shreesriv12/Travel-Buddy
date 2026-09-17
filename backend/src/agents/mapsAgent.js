import { z } from "zod";
import prisma from "../config/db.js";

const MapsArgs = z.object({ tripId: z.string().uuid(), action: z.enum(["directions"]).default("directions"), mode: z.enum(["driving", "walking", "bicycling"]).default("driving") });
const travelModes = { driving: "Car", walking: "Pedestrian", bicycling: "Bicycle" };

async function mapsExecute(args) {
  const { tripId, mode } = MapsArgs.parse(args);
  const apiKey = process.env.AMAZON_LOCATION_API_KEY;
  if (!apiKey) throw new Error("AMAZON_LOCATION_API_KEY is not set");
  const region = process.env.AWS_REGION || "us-east-1";
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { origin: true, destination: true, origin_coords: true, destination_coords: true } });
  if (!trip) throw new Error(`Trip ${tripId} not found`);
  const origin = trip.origin_coords || {};
  const destination = trip.destination_coords || {};
  if (![origin.lng, origin.lat, destination.lng, destination.lat].every(Number.isFinite)) throw new Error("Amazon Location route requires valid origin and destination coordinates");

  const response = await fetch(`https://routes.geo.${region}.amazonaws.com/v2/routes?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Origin: [origin.lng, origin.lat], Destination: [destination.lng, destination.lat], TravelMode: travelModes[mode], TravelStepType: "TurnByTurn", LegGeometryFormat: "Simple" }),
  });
  if (!response.ok) throw new Error(`Amazon Location Routes returned ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const route = payload.Routes?.[0];
  if (!route) throw new Error("Amazon Location Routes returned no route");
  const distanceKm = Number(route.Summary?.Distance || 0) / 1000;
  const durationMinutes = Math.round(Number(route.Summary?.Duration || 0) / 60);
  const steps = (route.Legs || []).flatMap((leg) => leg.Steps || []).map((step, index) => ({ step_number: index + 1, instruction: step.Instruction || step.Type || "Continue", distance: `${Math.round(Number(step.Distance || 0))} m`, duration: `${Math.round(Number(step.Duration || 0) / 60)} min`, type: mode }));
  const lineString = route.Legs?.flatMap((leg) => leg.Geometry?.LineString || []) || [];
  const record = await prisma.route.create({ data: { trip_id: tripId, from_location: trip.origin, to_location: trip.destination, transport_mode: mode, distance_km: distanceKm, duration_minutes: durationMinutes, estimated_cost: 0, route_data: { provider: "Amazon Location Routes", lineString, steps }, full_response: payload } });
  return { id: record.id, origin: trip.origin, destination: trip.destination, mode, distance: distanceKm, duration: durationMinutes, estimated_cost: 0, steps, lineString, summary: `Amazon Location route: ${distanceKm.toFixed(1)} km, ${durationMinutes} min via ${mode}` };
}

export const mapsAgent = { name: "mapsTool", description: "Calculates routes using Amazon Location Routes v2.", jsonSchema: { type: "object", properties: { tripId: { type: "string" }, action: { type: "string", enum: ["directions"] }, mode: { type: "string", enum: ["driving", "walking", "bicycling"] } }, required: ["tripId"] }, validate: (args) => MapsArgs.parse(args), execute: mapsExecute };
