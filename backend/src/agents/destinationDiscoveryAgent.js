import { getJson } from "serpapi";
import { z } from "zod";
import prisma from "../config/db.js";

const airportCodes = { mumbai: "BOM", delhi: "DEL", bangalore: "BLR", chennai: "MAA", kolkata: "CCU", hyderabad: "HYD", pune: "PNQ", ahmedabad: "AMD", jaipur: "JAI", goa: "GOI", "new york": "JFK", london: "LHR", paris: "CDG", dubai: "DXB", singapore: "SIN", bangkok: "BKK", tokyo: "NRT" };
const Args = z.object({ tripId: z.string().uuid(), origin: z.string().min(1), departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), currency: z.string().default("INR") });

async function execute(rawArgs) {
  const { tripId, origin, departureDate, returnDate, currency } = Args.parse(rawArgs);
  const departureId = airportCodes[origin.toLowerCase().trim()];
  const base = { destinationOptions: [], origin, provider: "SerpApi Google Travel Explore" };
  try {
    if (!process.env.SERPAPI_KEY) throw new Error("SERPAPI_KEY is not configured");
    if (!departureId) throw new Error(`Destination discovery needs a supported origin airport; ${origin} is not mapped yet.`);
    const response = await getJson({ engine: "google_travel_explore", departure_id: departureId, outbound_date: departureDate, return_date: returnDate, currency, gl: "in", hl: "en", api_key: process.env.SERPAPI_KEY });
    if (response.error) throw new Error(response.error);
    const destinationOptions = (response.destinations || []).slice(0, 12).map((item) => ({ name: item.name, country: item.country, airport: item.destination_airport?.code || null, flightPrice: item.flight_price ?? null, hotelPrice: item.hotel_price ?? null, flightDurationMinutes: item.flight_duration ?? null, stops: item.number_of_stops ?? null, thumbnail: item.thumbnail || null, link: item.link || null }));
    const result = { ...base, destinationOptions, summary: destinationOptions.length ? `Found ${destinationOptions.length} live destination ideas from ${origin}.` : `No live destination ideas were returned from ${origin}.` };
    await prisma.trip.update({ where: { id: tripId }, data: { discovery_data: result } });
    return result;
  } catch (error) {
    const result = { ...base, summary: `Live destination discovery is unavailable: ${error.message}`, error: error.message };
    await prisma.trip.update({ where: { id: tripId }, data: { discovery_data: result } }).catch(() => {});
    return result;
  }
}

export const destinationDiscoveryAgent = { name: "destinationDiscoveryAgent", description: "Suggests live flight and hotel-backed destinations from an origin using SerpApi Google Travel Explore.", jsonSchema: { type: "object", properties: { tripId: { type: "string" }, origin: { type: "string" }, departureDate: { type: "string" }, returnDate: { type: "string" }, currency: { type: "string" } }, required: ["tripId", "origin"] }, validate: (args) => Args.parse(args), execute };
