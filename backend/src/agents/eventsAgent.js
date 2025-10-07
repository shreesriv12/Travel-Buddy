import prisma from "../config/db.js";
import { z } from "zod";
import { getJson } from "serpapi";

// --------------------
// Validation schema
// --------------------
const EventArgs = z.object({
  tripId: z.string().uuid(),
  destination: z.string().min(1),
  date: z.string().optional(),
});

// --------------------
// Main execution function
// --------------------
async function eventExecute(args) {
  const { tripId, destination, date } = EventArgs.parse(args);
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) throw new Error("❌ SERPAPI_KEY is not set in environment variables");

  try {
    const query = `Events in ${destination}${date ? ` on ${date}` : ""}`;

    console.log(`[EventsAgent] 🔍 Searching: "${query}"`);

    // Fetch events via SerpApi
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
          if (!res) reject(new Error("No response from SerpApi"));
          else resolve(res);
        }
      );
    });

    const events = json.events_results || [];

    console.log(`[EventsAgent] 🌐 Retrieved ${events.length} events from SerpApi.`);

    // Clear existing DB entries for this trip
    await prisma.event.deleteMany({ where: { trip_id: tripId } });

    // Insert events into DB
    for (const e of events) {
      try {
        await prisma.event.create({
          data: {
            trip_id: tripId,
            title: e.title || "Unknown Event",
            venue: e.venue?.name || "Unknown Venue",
            description: e.description || "",
            location: e.address?.join(", ") || "Unknown Location",
            start_datetime: e.date?.start_date
              ? new Date(e.date.start_date)
              : new Date(),
            end_datetime: e.date?.end_date
              ? new Date(e.date.end_date)
              : new Date(),
            category: e.category || "General",
            price: 0,
            booking_url: e.link || null,
            is_recommended: false,
            relevance_score: 0,
            raw_json: e, // optional full JSON for debugging
          },
        });
      } catch (dbErr) {
        console.error(`[EventsAgent] ⚠️ DB insert error for event "${e.title}":`, dbErr.message);
      }
    }

    // ✅ Fetch back saved events for confirmation
    const savedEvents = await prisma.event.findMany({
      where: { trip_id: tripId },
    });

    console.log(`[EventsAgent] ✅ ${savedEvents.length} events saved to database:`);
    console.table(
      savedEvents.map((e) => ({
        title: e.title,
        venue: e.venue,
        location: e.location,
        start_datetime: e.start_datetime.toISOString().split("T")[0],
        booking_url: e.booking_url,
      }))
    );

    // Prepare API output
    const output = {
      summary: `Found ${events.length} events for ${destination}${date ? " on " + date : ""}`,
      events: events.map((e) => ({
        name: e.title || "Unknown Event",
        venue: e.venue?.name || "Unknown Venue",
        location: e.address?.join(", ") || "Unknown Location",
        start_time: e.date?.start_date || null,
        url: e.link || null,
      })),
    };

    console.log("[EventsAgent] 🎯 Output summary:", output.summary);
    return output;
  } catch (err) {
    console.error(`[EventsAgent] ❌ Error:`, err.message);
    return {
      summary: `No events found for ${destination}`,
      events: [],
    };
  }
}

// --------------------
// Agent definition
// --------------------
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
