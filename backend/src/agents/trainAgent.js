import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import prisma from "../config/db.js";

// --------------------
// Argument schema
// --------------------
const TrainArgs = z.object({
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tripId: z.string(),
  adults: z.number().int().min(1).max(10).default(1),
  currency: z.string().default("USD")
});

// --------------------
// Initialize Gemini AI
// --------------------
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --------------------
// Generate train options using Gemini
// --------------------
async function generateTrainOptions(origin, destination, departureDate, adults, currency) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are a train travel assistant. Provide realistic train options from ${origin} to ${destination} on ${departureDate} for ${adults} adult(s).

Return a JSON array of train options with the following structure for each train:
{
  "trainName": "Name of the train service",
  "trainNumber": "Train identification number",
  "departureTime": "HH:MM format",
  "arrivalTime": "HH:MM format", 
  "duration": "X hours Y minutes",
  "price": number (in ${currency}),
  "currency": "${currency}",
  "class": "Class type (e.g., First AC, Second AC, Sleeper, Chair Car)",
  "stops": [
    {"station": "Station name", "time": "HH:MM"}
  ],
  "serviceProvider": "Railway operator name",
  "type": "Express/Superfast/Mail/Passenger"
}

Provide 4-6 realistic train options with varying prices, classes, and timings. Consider:
- Real railway operators in the region
- Realistic travel times based on distance
- Appropriate pricing tiers
- Common train classes and types
- Typical departure times (morning, afternoon, evening, night)

Return ONLY the JSON array, no additional text.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("No valid JSON array found in response");
    }
    
    const trains = JSON.parse(jsonMatch[0]);
    
    // Add IDs and normalize data
    return trains.map((train, index) => ({
      id: `train_${Date.now()}_${index}`,
      trainName: train.trainName,
      trainNumber: train.trainNumber,
      departureTime: train.departureTime,
      arrivalTime: train.arrivalTime,
      duration: train.duration,
      price: train.price,
      currency: train.currency || currency,
      class: train.class,
      bookingLink: null,
      stops: train.stops || [],
      serviceProvider: train.serviceProvider,
      type: train.type,
      generatedBy: "Google Gemini AI"
    }));
  } catch (error) {
    console.error("[TrainAgent] Gemini API Error:", error.message);
    throw error;
  }
}

// --------------------
// Generate fallback train data
// --------------------
function generateFallbackTrainData(origin, destination, date, currency) {
  const trainTypes = [
    { name: "Rajdhani Express", class: "First AC", basePrice: 2500, speed: "Superfast" },
    { name: "Shatabdi Express", class: "Chair Car", basePrice: 1200, speed: "Fast" },
    { name: "Duronto Express", class: "Sleeper", basePrice: 800, speed: "Express" },
    { name: "Mail Express", class: "Second Sitting", basePrice: 400, speed: "Mail" }
  ];

  return trainTypes.map((train, index) => ({
    id: `fallback_train_${index + 1}`,
    trainName: train.name,
    trainNumber: `TR${2000 + index}`,
    departureTime: `${8 + index * 3}:00`,
    arrivalTime: `${14 + index * 3}:00`,
    duration: `${6 + index} hours`,
    price: train.basePrice,
    currency: currency,
    class: train.class,
    bookingLink: null,
    stops: [
      { station: `${origin} Central`, time: `${8 + index * 3}:00` },
      { station: "Intermediate Station", time: `${10 + index * 3}:00` },
      { station: `${destination} Junction`, time: `${14 + index * 3}:00` }
    ],
    serviceProvider: "Indian Railways",
    type: train.speed,
    fallback: true
  }));
}

// --------------------
// Main execute function
// --------------------
async function trainExecute(args) {
  const { origin, destination, departureDate, tripId, adults, currency } = TrainArgs.parse(args);

  console.log(`[TrainAgent] Starting train search for Trip ID: ${tripId}`);
  console.log(`[TrainAgent] From ${origin} to ${destination} on ${departureDate}`);

  try {
    // Generate train options using Gemini AI
    console.log("[TrainAgent] Requesting train options from Google Gemini AI");
    
    const trains = await generateTrainOptions(origin, destination, departureDate, adults, currency);

    console.log(`[TrainAgent] Generated ${trains.length} train options`);

    const result = {
      summary: `Found ${trains.length} train options from ${origin} to ${destination} on ${departureDate}.`,
      trains: trains,
      searchParams: {
        origin,
        destination,
        departureDate,
        adults,
        currency,
      },
      dataSource: "Google Gemini AI"
    };

    // Store in DB
    if (tripId) {
      await prisma.trip.update({
        where: { id: tripId },
        data: { trains_data: result },
      });
      console.log(`[TrainAgent] Saved train data to trip ${tripId}.`);
    }

    return result;

  } catch (err) {
    console.error("[TrainAgent] Error:", err.message);
    
    // Generate fallback data
    const fallbackTrains = generateFallbackTrainData(origin, destination, departureDate, currency);
    
    const errorResult = {
      summary: `Using simulated train data for ${origin} to ${destination}. Original error: ${err.message}`,
      trains: fallbackTrains,
      searchParams: { 
        origin, 
        destination, 
        departureDate, 
        adults, 
        currency 
      },
      error: err.message,
      fallback: true
    };

    if (tripId) {
      await prisma.trip.update({
        where: { id: tripId },
        data: { trains_data: errorResult },
      }).catch(e => console.error("Failed to update trip with train error:", e));
    }

    return errorResult;
  }
}

// --------------------
// Export agent
// --------------------
export const trainAgent = {
  name: "trainAgent",
  description: "Fetches train options between cities using Google Gemini AI.",
  jsonSchema: {
    type: "object",
    properties: {
      origin: { 
        type: "string", 
        description: "Origin city name" 
      },
      destination: { 
        type: "string", 
        description: "Destination city name" 
      },
      departureDate: { 
        type: "string", 
        description: "Departure date in YYYY-MM-DD format" 
      },
      tripId: { 
        type: "string", 
        description: "Trip ID to store the data for" 
      },
      adults: { 
        type: "integer", 
        description: "Number of adults (default: 1)" 
      },
      currency: { 
        type: "string", 
        description: "Currency code (default: USD)" 
      },
    },
    required: ["origin", "destination", "departureDate", "tripId"],
  },
  validate: (args) => TrainArgs.parse(args),
  execute: trainExecute,
};