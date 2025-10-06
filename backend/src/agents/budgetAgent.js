import prisma from "../config/db.js";
import { z } from "zod";

// --------------------
// Argument schema
// --------------------
const BudgetArgs = z.object({
  tripId: z.string().uuid(),
});

// --------------------
// Safe number extraction
// --------------------
function safeNumber(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue;
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

// --------------------
// Calculate budget breakdown
// --------------------
function calculateBudget(trip) {
  const adults = trip.adults || 1;
  const tripDuration = Math.max(1, Math.ceil(
    (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
  ));

  // Use reasonable defaults since we don't have flight/hotel APIs working
  const flightCost = 500 * adults;
  const hotelCost = 100 * tripDuration;
  const estimatedFood = tripDuration * adults * 50;
  const estimatedLocal = tripDuration * 30;
  const miscellaneous = Math.round((flightCost + hotelCost) * 0.1);

  const totalEstimate = Math.round(flightCost + hotelCost + estimatedFood + estimatedLocal + miscellaneous);

  return {
    breakdown: {
      flights: Math.round(flightCost),
      accommodation: Math.round(hotelCost),
      food: Math.round(estimatedFood),
      localTransport: Math.round(estimatedLocal),
      miscellaneous,
    },
    total: totalEstimate,
    perPerson: Math.round(totalEstimate / adults),
    currency: "USD",
  };
}

// --------------------
// Main execute function
// --------------------
async function budgetExecute(args) {
  const { tripId } = BudgetArgs.parse(args);

  // Fetch trip
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new Error("Trip not found");

  // Calculate budget with reasonable defaults
  const budget = calculateBudget(trip);

  // Clear existing budget items
  await prisma.budgetItem.deleteMany({
    where: { trip_id: tripId }
  });

  // Store in database
  await prisma.budgetItem.create({
    data: {
      trip_id: tripId,
      category: "Travel + Accommodation",
      item_name: "Estimated Trip Cost",
      estimated_amount: budget.total,
      actual_amount: 0,
      status: "Pending",
    },
  });

  // Store individual budget categories
  const categories = [
    { category: "Flights", item_name: "Round-trip flights", estimated_amount: budget.breakdown.flights },
    { category: "Accommodation", item_name: "Hotel stay", estimated_amount: budget.breakdown.accommodation },
    { category: "Food", item_name: "Meals and dining", estimated_amount: budget.breakdown.food },
    { category: "Transport", item_name: "Local transportation", estimated_amount: budget.breakdown.localTransport },
    { category: "Miscellaneous", item_name: "Other expenses", estimated_amount: budget.breakdown.miscellaneous },
  ];

  for (const category of categories) {
    await prisma.budgetItem.create({
      data: {
        trip_id: tripId,
        ...category,
        actual_amount: 0,
        status: "Pending",
      },
    });
  }

  console.log(`[Budget Agent] ✅ Budget calculated: ${budget.currency} ${budget.total}`);

  return {
    summary: `Estimated total budget: ${budget.currency} ${budget.total} (${budget.currency} ${budget.perPerson}/person)`,
    
    budget: {
      total: budget.total,
      perPerson: budget.perPerson,
      currency: budget.currency,
      status: "Estimated",
      breakdown: budget.breakdown,
    },

    recommendations: {
      savingTips: [
        "Book flights 2-3 months in advance for better prices",
        "Consider alternative accommodations like Airbnb",
        "Use public transportation to save on local transport",
        "Look for free activities and attractions",
      ],
    },

    tripInfo: {
      origin: trip.origin,
      destination: trip.destination,
      duration: `${Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24))} days`,
      travelers: adults,
    },
  };
}

export const budgetAgent = {
  name: "budgetAgent",
  description: "Calculates budget estimates for the trip based on destination and duration.",
  jsonSchema: {
    type: "object",
    properties: {
      tripId: { type: "string" },
    },
    required: ["tripId"],
  },
  validate: (args) => BudgetArgs.parse(args),
  execute: budgetExecute,
};