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
  const tripDuration = Math.max(
    1,
    Math.ceil(
      (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
    )
  );

  const flightCost = 500 * adults;
  const hotelCost = 100 * tripDuration;
  const estimatedFood = tripDuration * adults * 50;
  const estimatedLocal = tripDuration * 30;
  const miscellaneous = Math.round((flightCost + hotelCost) * 0.1);

  const totalEstimate =
    Math.round(flightCost + hotelCost + estimatedFood + estimatedLocal + miscellaneous);

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

  // Calculate budget
  const budget = calculateBudget(trip);

  // Delete old budget items
  await prisma.budgetItem.deleteMany({ where: { trip_id: tripId } });

  // Insert breakdown as BudgetItems
  const budgetItemsData = Object.entries(budget.breakdown).map(([category, amount]) => ({
    trip_id: tripId,
    category,
    item_name: category,
    estimated_amount: amount,
    actual_amount: 0,
    status: "Estimated",
  }));

  await prisma.budgetItem.createMany({ data: budgetItemsData });

  // Fetch and print all budget items for this trip
  const storedItems = await prisma.budgetItem.findMany({
    where: { trip_id: tripId },
    orderBy: { category: "asc" },
  });

  console.log(`\n✅ Stored BudgetItems for trip ${tripId}:`);
  storedItems.forEach(item => {
    console.log(
      `${item.category} - Estimated: ${item.estimated_amount}, Actual: ${item.actual_amount}, Status: ${item.status}`
    );
  });
  console.log("\n");

  // Update trip summary
  await prisma.trip.update({
    where: { id: tripId },
    data: {
      summary: {
        totalBudget: budget.total,
        perPerson: budget.perPerson,
        breakdown: budget.breakdown,
        status: "Estimated",
      },
      total_budget: budget.total,
    },
  });

  // Return full structured result
  return {
    tool: "budgetAgent",
    resultSummary: `Estimated total budget: ${budget.currency} ${budget.total} (${budget.currency} ${budget.perPerson}/person)`,
    result: {
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
        duration: `${Math.ceil(
          (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
        )} days`,
        travelers: trip.adults || 1,
      },
    },
  };
}

export const budgetAgent = {
  name: "budgetAgent",
  description: "Calculates budget estimates for the trip based on destination and duration.",
  jsonSchema: {
    type: "object",
    properties: { tripId: { type: "string" } },
    required: ["tripId"],
  },
  validate: (args) => BudgetArgs.parse(args),
  execute: budgetExecute,
};
