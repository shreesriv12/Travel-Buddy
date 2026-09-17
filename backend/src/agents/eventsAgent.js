import prisma from "../config/db.js";
import { z } from "zod";

const EventArgs = z.object({ tripId: z.string().uuid(), destination: z.string().min(1), date: z.string().optional() });

async function eventExecute(args) {
  const { tripId, destination, date } = EventArgs.parse(args);
  try {
    if (!process.env.TICKETMASTER_API_KEY) throw new Error("TICKETMASTER_API_KEY is not configured; no live events provider is available");
    const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
    url.search = new URLSearchParams({ apikey: process.env.TICKETMASTER_API_KEY, city: destination, countryCode: "IN", size: "50", ...(date ? { startDateTime: `${date}T00:00:00Z`, endDateTime: `${date}T23:59:59Z` } : {}) }).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Ticketmaster returned ${response.status}`);
    const payload = await response.json();
    const events = payload._embedded?.events || [];
    await prisma.event.deleteMany({ where: { trip_id: tripId } });
    for (const event of events) {
      const venue = event._embedded?.venues?.[0];
      const start = event.dates?.start?.dateTime || event.dates?.start?.localDate;
      if (!start) continue;
      await prisma.event.create({ data: { trip_id: tripId, title: event.name || "Untitled event", venue: venue?.name || "Unknown venue", description: event.info || event.pleaseNote || "", location: venue?.city?.name || destination, start_datetime: new Date(start), end_datetime: event.dates?.end?.dateTime ? new Date(event.dates.end.dateTime) : new Date(start), category: event.classifications?.[0]?.segment?.name || "General", price: event.priceRanges?.[0]?.min || 0, booking_url: event.url || null, is_recommended: false, relevance_score: 0, raw_json: event } });
    }
    return { summary: events.length ? `Found ${events.length} live Ticketmaster events for ${destination}.` : `No live Ticketmaster events found for ${destination}.`, dataSource: "Ticketmaster", events: events.map((event) => ({ name: event.name, venue: event._embedded?.venues?.[0]?.name || "Unknown venue", location: event._embedded?.venues?.[0]?.city?.name || destination, start_time: event.dates?.start?.dateTime || event.dates?.start?.localDate || null, url: event.url || null })) };
  } catch (error) {
    console.error("[EventsAgent] Live event search failed:", error.message);
    await prisma.event.deleteMany({ where: { trip_id: tripId } });
    return { summary: `Live events are unavailable: ${error.message}`, events: [], unavailable: true, error: error.message };
  }
}

export const eventsAgent = { name: "eventsAgent", description: "Fetches provider-backed destination events and stores them in DB.", jsonSchema: { type: "object", properties: { tripId: { type: "string" }, destination: { type: "string" }, date: { type: "string" } }, required: ["tripId", "destination"] }, validate: (args) => EventArgs.parse(args), execute: eventExecute };
