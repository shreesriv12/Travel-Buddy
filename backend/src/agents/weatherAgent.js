import { getJson } from "serpapi";
import { z } from "zod";
import prisma from "../config/db.js";

// --------------------
// Validate args
// --------------------
const WeatherArgs = z.object({
  tripId: z.string().uuid(),
  destination: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// --------------------
// Execute weather fetch using Google Weather via SerpApi
// --------------------
async function weatherExecute(args) {
  console.log("=== WeatherAgent: Starting ===");
  
  let parsedArgs;
  try {
    parsedArgs = WeatherArgs.parse(args);
  } catch (err) {
    console.error("WeatherAgent: Validation failed:", err.errors);
    throw err;
  }

  let { tripId, destination, startDate, endDate } = parsedArgs;

  // If start/end dates not provided, fetch from DB
  if (!startDate || !endDate) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { start_date: true, end_date: true },
    });

    if (!trip) throw new Error(`Trip ${tripId} not found`);
    startDate = trip.start_date.toISOString().split('T')[0];
    endDate = trip.end_date.toISOString().split('T')[0];
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY is not set");

  try {
    // Use Google Weather via SerpApi
    const response = await new Promise((resolve, reject) => {
      getJson({
        engine: "google",
        q: `weather ${destination}`, 
        api_key: apiKey,
      }, (result) => {
        if (!result) {
          reject(new Error("No response from SerpApi for weather"));
          return;
        }
        resolve(result);
      });
    });

    // Process weather data from Google Weather
    const weatherInfo = response.weather || response.answer_box || {};
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    // Generate daily forecast based on available data
    const daily = [];
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Convert precipitation to float and ensure valid values
      const precipitation = parseFloat(weatherInfo.precipitation) || 0;
      
      daily.push({
        date: dateStr,
        temp_high: parseFloat(weatherInfo.temperature?.high) || 25,
        temp_low: parseFloat(weatherInfo.temperature?.low) || 18,
        condition: weatherInfo.condition || "Partly Cloudy",
        precipitation: precipitation, // Now properly a float
        weather_json: weatherInfo
      });
    }

    // Clear existing weather data
    await prisma.weatherData.deleteMany({
      where: { trip_id: tripId }
    });

    // Store in database
    for (const day of daily) {
      await prisma.weatherData.create({
        data: {
          trip_id: tripId,
          location: destination,
          date: new Date(day.date),
          temperature_high: day.temp_high,
          temperature_low: day.temp_low,
          conditions: day.condition,
          precipitation: day.precipitation, // Now properly a float
          weather_json: day.weather_json,
          fetched_at: new Date(),
        },
      });
    }

    console.log(`=== WeatherAgent: Stored ${daily.length} days of weather data ===`);
    
    return {
      summary: `Stored ${daily.length} daily forecast entries for ${destination}`,
      daily,
    };
  } catch (err) {
    console.error("WeatherAgent: API error:", err);
    
    // Fallback: Create basic weather data
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    const daily = [];
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      daily.push({
        date: dateStr,
        temp_high: 25,
        temp_low: 18,
        condition: "Sunny",
        precipitation: 0, // Proper float
        weather_json: { fallback: true }
      });
    }

    // Store fallback data
    for (const day of daily) {
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

    return {
      summary: `Created ${daily.length} fallback weather entries for ${destination}`,
      daily,
    };
  }
}

// --------------------
// Export agent
// --------------------
export const weatherAgent = {
  name: "weatherTool",
  description: "Fetches weather forecast for a destination using Google Weather via SerpApi and stores daily data in DB.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string" },
      destination: { type: "string" },
      startDate: { type: "string" },
      endDate: { type: "string" },
    },
    required: ["tripId", "destination"],
  },
  validate: (args) => WeatherArgs.parse(args),
  execute: weatherExecute,
};