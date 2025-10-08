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
// Extract prices from flight and hotel data
// --------------------
function extractActualPrices(trip) {
  let flightCost = 0;
  let hotelCost = 0;

  // Extract flight cost from flights_data
  if (trip.flights_data && typeof trip.flights_data === 'object') {
    const flightsData = trip.flights_data;
    
    // Try to get price from best_flights
    if (flightsData.best_flights && flightsData.best_flights.length > 0) {
      const bestFlight = flightsData.best_flights[0];
      flightCost = safeNumber(bestFlight.price, 0);
    }
    
    // If no best flights, try other_flights
    if (flightCost === 0 && flightsData.other_flights && flightsData.other_flights.length > 0) {
      const otherFlight = flightsData.other_flights[0];
      flightCost = safeNumber(otherFlight.price, 0);
    }
    
    console.log(`[BudgetAgent] Extracted flight cost: ${flightCost}`);
  }

  // Extract hotel cost from hotels_data
  if (trip.hotels_data && typeof trip.hotels_data === 'object') {
    const hotelsData = trip.hotels_data;
    
    if (hotelsData.hotels && hotelsData.hotels.length > 0) {
      // Use the first hotel's total price for the entire stay
      const firstHotel = hotelsData.hotels[0];
      hotelCost = safeNumber(firstHotel.totalPrice, 0);
      
      // If totalPrice isn't available, calculate from price per night
      if (hotelCost === 0 && firstHotel.price) {
        const nights = Math.ceil(
          (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
        );
        hotelCost = safeNumber(firstHotel.price) * nights;
      }
    }
    
    console.log(`[BudgetAgent] Extracted hotel cost: ${hotelCost}`);
  }

  return { flightCost, hotelCost };
}

// --------------------
// Calculate budget breakdown dynamically
// --------------------
function calculateBudget(trip) {
  const adults = trip.adults || 1;
  const children = trip.children || 0;
  const totalTravelers = adults + children;
  
  const tripDuration = Math.max(
    1,
    Math.ceil(
      (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
    )
  );

  // Extract actual prices from flight and hotel data
  const { flightCost, hotelCost } = extractActualPrices(trip);

  // Use actual prices if available, otherwise use estimates
  const finalFlightCost = flightCost > 0 ? flightCost : (500 * adults);
  const finalHotelCost = hotelCost > 0 ? hotelCost : (100 * tripDuration);
  
  // Calculate other expenses based on actual data when available
  const estimatedFood = tripDuration * totalTravelers * (hotelCost > 0 ? 40 : 50);
  const estimatedLocal = tripDuration * (hotelCost > 0 ? 25 : 30);
  const miscellaneous = Math.round((finalFlightCost + finalHotelCost) * 0.1);

  const totalEstimate = Math.round(
    finalFlightCost + finalHotelCost + estimatedFood + estimatedLocal + miscellaneous
  );

  return {
    breakdown: {
      flights: Math.round(finalFlightCost),
      accommodation: Math.round(finalHotelCost),
      food: Math.round(estimatedFood),
      localTransport: Math.round(estimatedLocal),
      miscellaneous,
    },
    total: totalEstimate,
    perPerson: Math.round(totalEstimate / adults),
    currency: "USD",
    dataSources: {
      flights: flightCost > 0 ? "real" : "estimated",
      hotels: hotelCost > 0 ? "real" : "estimated",
      others: "estimated"
    }
  };
}

// --------------------
// Main execute function
// --------------------
async function budgetExecute(args) {
  const { tripId } = BudgetArgs.parse(args);

  // Fetch trip with flights and hotels data
  const trip = await prisma.trip.findUnique({ 
    where: { id: tripId }
  });
  
  if (!trip) throw new Error("Trip not found");

  console.log(`[BudgetAgent] Calculating budget for trip: ${tripId}`);
  console.log(`[BudgetAgent] Trip has flights_data: ${!!trip.flights_data}`);
  console.log(`[BudgetAgent] Trip has hotels_data: ${!!trip.hotels_data}`);

  // Calculate budget using actual data when available
  const budget = calculateBudget(trip);

  // Delete old budget items
  await prisma.budgetItem.deleteMany({ where: { trip_id: tripId } });

  // Insert breakdown as BudgetItems
  const budgetItemsData = Object.entries(budget.breakdown).map(([category, amount]) => ({
    trip_id: tripId,
    category,
    item_name: category.charAt(0).toUpperCase() + category.slice(1),
    estimated_amount: amount,
    actual_amount: 0,
    status: budget.dataSources[category] === "real" ? "Based on Real Data" : "Estimated",
  }));

  await prisma.budgetItem.createMany({ data: budgetItemsData });

  const storedItems = await prisma.budgetItem.findMany({
    where: { trip_id: tripId },
    orderBy: { estimated_amount: "desc" },
  });

  console.log(`\n Stored BudgetItems for trip ${tripId}:`);
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
        status: "Calculated",
        dataSources: budget.dataSources,
        lastUpdated: new Date().toISOString()
      },
      total_budget: budget.total,
    },
  });

  // Return full structured result (maintaining frontend compatibility)
  return {
    tool: "budgetAgent",
    resultSummary: `Calculated total budget: ${budget.currency} ${budget.total} (${budget.currency} ${budget.perPerson}/person)`,
    result: {
      summary: `Calculated total budget: ${budget.currency} ${budget.total} (${budget.currency} ${budget.perPerson}/person)`,
      budget: {
        total: budget.total,
        perPerson: budget.perPerson,
        currency: budget.currency,
        status: "Calculated",
        breakdown: budget.breakdown,
        dataSources: budget.dataSources
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
  description: "Calculates budget estimates for the trip using actual flight and hotel data when available.",
  jsonSchema: {
    type: "object",
    properties: { tripId: { type: "string" } },
    required: ["tripId"],
  },
  validate: (args) => BudgetArgs.parse(args),
  execute: budgetExecute,
};