import prisma from "../config/db.js";
import { z } from "zod";
import { getJson } from "serpapi";

const EventArgs = z.object({
  tripId: z.string().uuid(),
  destination: z.string().min(1),
  date: z.string().optional(), // optional date filter (YYYY-MM-DD)
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
          if (!res || !res.events_results) return resolve({ events_results: [] });
          resolve(res);
        }
      );
    });

    const events = json.events_results || [];

    for (const e of events) {
      try {
        await prisma.event.create({
          data: {
            trip_id: tripId,
            title: e.title,
            description: e.description ?? "",
            location: e.address?.join(", ") ?? "Unknown",
            start_datetime: e.date?.start_date ? new Date(e.date.start_date) : new Date(),
            end_datetime: e.date?.start_date ? new Date(e.date.start_date) : new Date(),
            category: "", // Google Events API does not provide a clear category field
            price: 0, // No price info available
            booking_url: e.link ?? null,
            is_recommended: false,
            relevance_score: 0,
          },
        });
      } catch (dbErr) {
        console.error(`[Event Tool Error] DB error for event '${e.title}':`, dbErr);
      }
    }

    const output = {
      summary: `Stored ${events.length} events for ${destination}${date ? " on " + date : ""}`,
      events: events.map((e) => ({
        name: e.title,
        venue: e.venue?.name,
        location: e.address?.join(", "),
        city: e.address?.[1] ?? null,
        start_time: e.date?.start_date,
        url: e.link,
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

