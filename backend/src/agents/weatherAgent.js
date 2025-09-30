import prisma from "../config/db.js";
import { z } from "zod";


const WeatherArgs = z.object({
  tripId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  destination: z.string().min(1),
});

async function weatherExecute(args) {
  const { tripId, lat, lng, destination } = WeatherArgs.parse(args);

  const apiKey = process.env.OPENWEATHER_KEY;
  if (!apiKey) {
    throw new Error("OPENWEATHER_KEY is not set");
  }

  const url =
    `https://api.openweathermap.org/data/2.5/forecast` +
    `?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenWeather error: ${res.status} ${text}`);
  }
  const forecast = await res.json();

  const noons = (forecast?.list || []).filter((f) =>
    String(f.dt_txt || "").includes("12:00:00")
  );

  for (const day of noons) {
    await prisma.weatherData.create({
      data: {
        trip_id: tripId,
        location: destination,
        date: new Date(day.dt_txt),
        temperature_high: day.main?.temp_max ?? null,
        temperature_low: day.main?.temp_min ?? null,
        conditions: day.weather?.[0]?.main ?? "Unknown",
        precipitation: day.pop ?? 0,
        weather_json: day,
        fetched_at: new Date(),
      },
    });
  }

  return {
    summary: `Stored ${noons.length} forecast entries for ${destination}`,
    forecastDays: noons.length,
    raw: forecast,
  };
}

export const weatherAgent = {
  name: "weatherTool",
  description:
    "Fetches a 5-day forecast for a destination and stores daily noon snapshots in DB.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string", description: "Trip UUID" },
      lat: { type: "number", description: "Latitude" },
      lng: { type: "number", description: "Longitude" },
      destination: { type: "string", description: "City or place name" },
    },
    required: ["tripId", "lat", "lng", "destination"],
  },
  validate: (args) => WeatherArgs.parse(args),
  execute: weatherExecute,
};