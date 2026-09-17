import { getJson } from "serpapi";
import prisma from "../config/db.js";
import { z } from "zod";

const EventArgs = z.object({ tripId: z.string().uuid(), destination: z.string().min(1), date: z.string().optional() });

function eventDate(event, fallbackDate) {
  const candidate = event.date?.start_date || event.date?.when || event.start_date || fallbackDate;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? new Date(`${fallbackDate || new Date().toISOString().slice(0, 10)}T12:00:00Z`) : parsed;
}

async function eventExecute(args) {
  const { tripId, destination, date } = EventArgs.parse(args);
  try {
    if (!process.env.SERPAPI_KEY) throw new Error("SERPAPI_KEY is not configured");
    const payload = await getJson({ engine: "google_events", q: `events in ${destination}`, location: destination, hl: "en", gl: "in", api_key: process.env.SERPAPI_KEY });
    if (payload.error) throw new Error(payload.error);
    const events = payload.events_results || [];
    await prisma.event.deleteMany({ where: { trip_id: tripId } });
    for (const event of events) {
      const start = eventDate(event, date);
      await prisma.event.create({ data: {
        trip_id: tripId,
        title: event.title || "Untitled event",
        venue: event.venue?.name || event.address?.[0] || null,
        description: event.description || "",
        location: event.address?.join(", ") || destination,
        start_datetime: start,
        end_datetime: start,
        category: event.type?.[0] || "Local event",
        price: Number(String(event.ticket_info?.[0]?.price || "").replace(/[^0-9.]/g, "")) || 0,
        booking_url: event.link || event.ticket_info?.[0]?.link || null,
        is_recommended: false,
        relevance_score: 0,
        raw_json: event,
      } });
    }
    return {
      summary: events.length ? `Found ${events.length} live SerpApi Google Events results for ${destination}.` : `No live SerpApi Google Events results found for ${destination}.`,
      dataSource: "SerpApi Google Events",
      events: events.map((event) => ({ name: event.title, venue: event.venue?.name || event.address?.[0] || "Unknown venue", location: event.address?.join(", ") || destination, start_time: event.date?.start_date || event.date?.when || null, url: event.link || event.ticket_info?.[0]?.link || null })),
    };
  } catch (error) {
    console.error("[EventsAgent] SerpApi event search failed:", error.message);
    await prisma.event.deleteMany({ where: { trip_id: tripId } });
    return { summary: `Live events are unavailable: ${error.message}`, events: [], unavailable: true, error: error.message };
  }
}

export const eventsAgent = { name: "eventsAgent", description: "Fetches current local events using SerpApi Google Events and stores them in the trip.", jsonSchema: { type: "object", properties: { tripId: { type: "string" }, destination: { type: "string" }, date: { type: "string" } }, required: ["tripId", "destination"] }, validate: (args) => EventArgs.parse(args), execute: eventExecute };
