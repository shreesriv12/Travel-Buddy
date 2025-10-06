import prisma from "../config/db.js";
import { z } from "zod";
import { getJson } from "serpapi";

const EventArgs = z.object({
  tripId: z.string().uuid(),
  destination: z.string().min(1),
  date: z.string().optional(),
});

async function eventExecute(args) {
  const { tripId, destination, date } = EventArgs.parse(args);

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY is not set");
  }

  try {
    const query = `Events in ${destination}${date ? ` on ${date}` : ""}`;

    // Fetch events from Google Events via SerpApi
    const json = await new Promise((resolve, reject) => {
      getJson(
        {
          engine: "google_events",
          q: query,
          hl: "en",
          gl: "us",
          api_key: apiKey,
        },
        (res) => {
          if (!res) {
            reject(new Error("No response from SerpApi"));
            return;
          }
          resolve(res);
        }
      );
    });

    const events = json.events_results || [];

    // Clear existing events for this trip
    await prisma.event.deleteMany({
      where: { trip_id: tripId }
    });

    for (const e of events) {
      try {
        await prisma.event.create({
          data: {
            trip_id: tripId,
            title: e.title || "Unknown Event",
            description: e.description || "",
            location: e.address?.join(", ") || "Unknown",
            start_datetime: e.date?.start_date ? new Date(e.date.start_date) : new Date(),
            end_datetime: e.date?.end_date ? new Date(e.date.end_date) : new Date(),
            category: e.category || "General",
            price: 0,
            booking_url: e.link || null,
            is_recommended: false,
            relevance_score: 0,
          },
        });
      } catch (dbErr) {
        console.error(`[EventsAgent] DB error for event:`, dbErr);
      }
    }

    const output = {
      summary: `Found ${events.length} events for ${destination}${date ? " on " + date : ""}`,
      events: events.map((e) => ({
        name: e.title,
        venue: e.venue?.name,
        location: e.address?.join(", "),
        start_time: e.date?.start_date,
        url: e.link,
      })),
    };

    console.log("[EventsAgent] Output:", output.summary);
    return output;
  } catch (err) {
    console.error(`[EventsAgent] Error:`, err.message);
    
    // Return empty events on failure
    return {
      summary: `No events found for ${destination}`,
      events: [],
    };
  }
}

export const eventsAgent = {
  name: "eventsAgent",
  description: "Fetches upcoming events for a destination and stores them in DB.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string" },
      destination: { type: "string" },
      date: { type: "string" },
    },
    required: ["tripId", "destination"],
  },
  validate: (args) => EventArgs.parse(args),
  execute: eventExecute,
};