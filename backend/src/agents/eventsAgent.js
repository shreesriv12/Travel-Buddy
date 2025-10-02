import prisma from "../config/db.js";
import { z } from "zod";

const EventArgs = z.object({
  tripId: z.string().uuid(),
  destination: z.string().min(1),   // replaces city
  date: z.string().optional(),      // optional date filter (YYYY-MM-DD)
});

async function eventExecute(args) {
  const { tripId, destination, date } = EventArgs.parse(args);

  const apiKey = process.env.TICKETMASTER_KEY;
  if (!apiKey) {
    throw new Error("TICKETMASTER_KEY is not set");
  }

  // Build Ticketmaster API URL
  let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&size=10&sort=date,asc&city=${encodeURIComponent(
    destination
  )}`;

  if (date) {
    // Ticketmaster supports startDateTime in ISO format
    const startDateTime = new Date(date).toISOString();
    url += `&startDateTime=${encodeURIComponent(startDateTime)}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[Event Tool Error] Ticketmaster error: ${res.status} ${text}`);
      throw new Error(`Ticketmaster error: ${res.status} ${text}`);
    }
    const data = await res.json();

    const events = data._embedded?.events || [];

    for (const e of events) {
      try {
        await prisma.event.create({
          data: {
            trip_id: tripId,
            title: e.name,
            description: e.info ?? "",
            location: e._embedded?.venues?.[0]?.address?.line1 ?? "Unknown",
            start_datetime: e.dates?.start?.dateTime ? new Date(e.dates.start.dateTime) : new Date(),
            end_datetime: e.dates?.end?.dateTime ? new Date(e.dates.end.dateTime) : new Date(),
            category: e.classifications?.[0]?.segment?.name ?? "",
            price: e.priceRanges?.[0]?.min ?? 0,
            booking_url: e.url ?? null,
            is_recommended: false,
            relevance_score: 0,
          },
        });
      } catch (dbErr) {
        console.error(`[Event Tool Error] DB error for event '${e.name}':`, dbErr);
      }
    }

    const output = {
      summary: `Stored ${events.length} events for ${destination}${
        date ? " on " + date : ""
      }`,
      events: events.map((e) => ({
        name: e.name,
        venue: e._embedded?.venues?.[0]?.name,
        location: e._embedded?.venues?.[0]?.address?.line1,
        city: e._embedded?.venues?.[0]?.city?.name,
        start_time: e.dates?.start?.dateTime,
        url: e.url,
      })),
    };
    console.log("[Event Tool Output]", JSON.stringify(output, null, 2));
    return output;
  } catch (err) {
    console.error(`[Event Tool Error] General failure:`, err);
    throw err;
  }
}

export const eventsAgent = {
  name: "eventTool",
  description:
    "Fetches upcoming events for a destination with exact location, venue, and timing, and stores them in DB.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string", description: "Trip UUID" },
      destination: { type: "string", description: "Destination/place name" },
      date: {
        type: "string",
        description: "Optional date filter (YYYY-MM-DD)",
      },
    },
    required: ["tripId", "destination"],
  },
  validate: (args) => EventArgs.parse(args),
  execute: eventExecute,
};