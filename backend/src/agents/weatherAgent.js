import prisma from "../config/db.js";
import { z } from "zod";
import axios from "axios";

// --------------------
// Validate args
// --------------------
const WeatherArgs = z.object({
  tripId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  destination: z.string().min(1),
  startDate: z.string().optional(), // Trip start
  endDate: z.string().optional(),   // Trip end
});

// --------------------
// Execute weather fetch
// --------------------
async function weatherExecute(args) {
  console.log("=== Debug: weatherExecute input args ===");
  console.log(args);

  let parsedArgs;
  try {
    parsedArgs = WeatherArgs.parse(args);
  } catch (err) {
    console.error("Zod validation failed in weatherExecute:", err.errors);
    throw err; // rethrow after logging
  }

  let { tripId, lat, lng, destination, startDate, endDate } = parsedArgs;

  // If start/end dates not provided, fetch from DB
  if (!startDate || !endDate) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { start_date: true, end_date: true },
    });

    if (!trip) throw new Error(`Trip ${tripId} not found`);
    startDate ||= trip.start_date.toISOString();
    endDate ||= trip.end_date.toISOString();
  }

  const apiKey = process.env.OPENWEATHER_KEY;
  if (!apiKey) throw new Error("OPENWEATHER_KEY is not set");

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;

  let forecast;
  try {
    const res = await axios.get(url);
    forecast = res.data;
  } catch (err) {
    throw new Error(`OpenWeather API error: ${err.message}`);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  const dailyMap = {};

  (forecast.list || []).forEach((f) => {
    const dateStr = f.dt_txt.split(" ")[0];
    const dateObj = new Date(dateStr);

    if (dateObj < start || dateObj > end) return;

    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = {
        date: dateStr,
        temp_high: f.main?.temp_max ?? null,
        temp_low: f.main?.temp_min ?? null,
        condition: f.weather?.[0]?.description ?? "Unknown",
        precipitation: f.pop ?? 0,
        weather_json: f,
      };
    } else {
      dailyMap[dateStr].temp_high = Math.max(
        dailyMap[dateStr].temp_high ?? -Infinity,
        f.main?.temp_max ?? -Infinity
      );
      dailyMap[dateStr].temp_low = Math.min(
        dailyMap[dateStr].temp_low ?? Infinity,
        f.main?.temp_min ?? Infinity
      );
      dailyMap[dateStr].precipitation = Math.max(
        dailyMap[dateStr].precipitation ?? 0,
        f.pop ?? 0
      );
    }
  });

  const daily = Object.values(dailyMap);

 for (const day of daily) {
  const existing = await prisma.weatherData.findFirst({
    where: { trip_id: tripId, date: new Date(day.date) },
  });

  if (existing) {
    await prisma.weatherData.update({
      where: { id: existing.id },
      data: {
        location: destination,
        temperature_high: day.temp_high,
        temperature_low: day.temp_low,
        conditions: day.condition,
        precipitation: day.precipitation,
        weather_json: day.weather_json,
        fetched_at: new Date(),
      },
    });
  } else {
    await prisma.weatherData.create({
      data: {
        trip_id: tripId,
        location: destination,
        date: new Date(day.date),
        temperature_high: day.temp_high,
        temperature_low: day.temp_low,
        conditions: day.condition,
        precipitation: day.precipitation,
        weather_json: day.weather_json,
        fetched_at: new Date(),
      },
    });
  }
}


  return {
    summary: `Stored ${daily.length} daily forecast entries for ${destination}`,
    daily,
  };
}

// --------------------
// Export agent
// --------------------
export const weatherAgent = {
  name: "weatherTool",
  description: "Fetches 5-day forecast for a destination and stores daily data in DB.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string" },
      lat: { type: "number" },
      lng: { type: "number" },
      destination: { type: "string" },
      startDate: { type: "string" },
      endDate: { type: "string" },
    },
    required: ["tripId", "lat", "lng", "destination"],
  },
  validate: (args) => WeatherArgs.parse(args),
  execute: weatherExecute,
};

