// weatherAgent.js
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
        q: `weather for ${destination}`,
        api_key: apiKey,
      }, (result) => {
        if (!result) {
          reject(new Error("No response from SerpApi for weather"));
          return;
        }
        resolve(result);
      });
    });

    // --- CRITICAL FIX STARTS HERE ---
    const weatherInfo = response.weather || response.answer_box || {};
    const forecastDays = weatherInfo.forecast;

    if (!forecastDays || !Array.isArray(forecastDays) || forecastDays.length === 0) {
      throw new Error("SerpApi did not return a valid multi-day forecast.");
    }
    
    // Calculate trip duration to know how many days to process
    const start = new Date(startDate);
    const end = new Date(endDate);
    const tripDurationInDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const dailyForecast = [];
    
    // Loop over the *actual forecast data* from SerpApi,
    // not a hardcoded range.
    for (let i = 0; i < forecastDays.length && i < tripDurationInDays; i++) {
        const forecastDay = forecastDays[i];
        
        // Extract and normalize data
        const tempHigh = parseFloat(forecastDay.temperature?.high) || 0;
        const tempLow = parseFloat(forecastDay.temperature?.low) || 0;
        const condition = forecastDay.weather || "Not specified";
        
        // Precipitation needs to be parsed from a string like "20%"
        const precipitationStr = forecastDay.precipitation || '0%';
        const precipitation = parseFloat(precipitationStr.replace('%', '')) || 0;
        
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];

        dailyForecast.push({
            date: dateStr,
            temp_high: tempHigh,
            temp_low: tempLow,
            condition: condition,
            precipitation: precipitation,
            weather_json: forecastDay // Store the raw daily JSON here for reference
        });
    }

    // --- FIX ENDS HERE ---
    
    // Clear existing weather data
    await prisma.weatherData.deleteMany({
      where: { trip_id: tripId }
    });

    // Store the correctly parsed data in the database
    for (const day of dailyForecast) {
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

    console.log(`=== WeatherAgent: Stored ${dailyForecast.length} days of weather data ===`);
    
    return {
      summary: `Stored ${dailyForecast.length} daily forecast entries for ${destination}`,
      daily: dailyForecast,
    };
  } catch (err) {
    console.error("WeatherAgent: API error:", err);
    
    // Fallback logic remains the same for when the API call fails entirely
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
        precipitation: 0,
        weather_json: { fallback: true, error: err.message }
      });
    }
    
    await prisma.weatherData.deleteMany({
        where: { trip_id: tripId }
    });

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
      summary: `Created ${daily.length} fallback weather entries for ${destination} due to API error.`,
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