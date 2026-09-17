import { z } from "zod";
import prisma from "../config/db.js";
import { generateGroqText } from "../config/groq.js";

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
// Generate train options using Groq
// --------------------
async function generateTrainOptions(origin, destination, departureDate, adults, currency) {
  const prompt = `You are a train travel assistant. Provide realistic train options from ${origin} to ${destination} on ${departureDate} for ${adults} adult(s).

Return a JSON object with a "trains" array. Each train has this structure:
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

Return ONLY the JSON object, no additional text.`;

  try {
    const text = await generateGroqText("You provide accurate, structured train travel options.", prompt, 0.2, true);
    
    // Extract JSON from the response
    const parsed = JSON.parse(text);
    const trains = parsed.trains;
    if (!Array.isArray(trains)) throw new Error("Groq response did not include a trains array");
    
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
      generatedBy: "Groq AI"
    }));
  } catch (error) {
    console.error("[TrainAgent] LLM response error:", error.message);
    throw error;
  }
}

// --------------------
// Main execute function
// --------------------
async function trainExecute(args) {
  const { origin, destination, departureDate, tripId, adults, currency } = TrainArgs.parse(args);

  console.log(`[TrainAgent] Starting train search for Trip ID: ${tripId}`);
  console.log(`[TrainAgent] From ${origin} to ${destination} on ${departureDate}`);

  try {
    console.log("[TrainAgent] Requesting structured train options from the configured LLM");
    
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
      dataSource: "Groq AI"
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
    
    const errorResult = {
      summary: `Live train results are unavailable: ${err.message}`,
      trains: [],
      searchParams: { 
        origin, 
        destination, 
        departureDate, 
        adults, 
        currency 
      },
      error: err.message,
      unavailable: true
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
  description: "Fetches train options between cities using Groq AI.",
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
