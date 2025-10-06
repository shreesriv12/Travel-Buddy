// --------------------
// Imports
// --------------------
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { weatherAgent } from "./weatherAgent.js";
import { budgetAgent } from "./budgetAgent.js";
import { eventsAgent } from "./eventsAgent.js";
import { itineraryAgent } from "./itineraryAgent.js";
import { mapsAgent } from "./mapsAgent.js";
import { flightAgent } from "./flightAgent.js";
import prisma from "../config/db.js";

// --------------------
// Tool Registry
// --------------------
const TOOL_REGISTRY = {
  [weatherAgent.name]: weatherAgent,
  [budgetAgent.name]: budgetAgent,
  [eventsAgent.name]: eventsAgent,
  [itineraryAgent.name]: itineraryAgent,
  [mapsAgent.name]: mapsAgent,
  [flightAgent.name]: flightAgent,
};

// --------------------
// Main Orchestrator - Simplified Sequential Execution
// --------------------
export async function runMCPOrchestrator(trip, { maxSteps = 10 } = {}) {
  console.log("\n=== MCP Orchestrator Started ===");
  console.log(`[Orchestrator] Trip ID: ${trip.id}, Destination: ${trip.destination}`);

  const previousToolResults = [];

  try {
    // ============================================
    // 1️⃣ WEATHER AGENT (Always first)
    // ============================================
    console.log("[Orchestrator] Executing weatherAgent...");
    try {
      const result = await weatherAgent.execute({
        tripId: trip.id,
        destination: trip.destination,
        startDate: trip.start_date?.toISOString().split('T')[0],
        endDate: trip.end_date?.toISOString().split('T')[0]
      });

      previousToolResults.push({
        tool: weatherAgent.name,
        resultSummary: result.summary || "Weather data fetched",
        result
      });
      console.log("[Orchestrator] ✅ weatherAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ weatherAgent failed:", error.message);
      previousToolResults.push({
        tool: weatherAgent.name,
        resultSummary: "Weather data fetch failed",
        error: error.message
      });
    }

    // ============================================
    // 2️⃣ FLIGHT AGENT (Find flights)
    // ============================================
    console.log("[Orchestrator] Executing flightAgent...");
    try {
      const result = await flightAgent.execute({
        origin: trip.origin,
        destination: trip.destination,
        departureDate: trip.start_date?.toISOString().split('T')[0],
        returnDate: trip.end_date?.toISOString().split('T')[0],
        adults: trip.adults || 1
      });

      previousToolResults.push({
        tool: flightAgent.name,
        resultSummary: result.summary || "Flights found",
        result
      });
      console.log("[Orchestrator] ✅ flightAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ flightAgent failed:", error.message);
      previousToolResults.push({
        tool: flightAgent.name,
        resultSummary: "Flight search failed",
        error: error.message
      });
    }

    // ============================================
    // 3️⃣ BUDGET AGENT (After flights)
    // ============================================
    console.log("[Orchestrator] Executing budgetAgent...");
    try {
      const result = await budgetAgent.execute({
        tripId: trip.id,
        adults: trip.adults || 1
      });

      previousToolResults.push({
        tool: budgetAgent.name,
        resultSummary: result.summary || "Budget calculated",
        result
      });
      console.log("[Orchestrator] ✅ budgetAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ budgetAgent failed:", error.message);
      previousToolResults.push({
        tool: budgetAgent.name,
        resultSummary: "Budget calculation failed",
        error: error.message
      });
    }

    // ============================================
    // 4️⃣ EVENTS AGENT (After budget)
    // ============================================
    console.log("[Orchestrator] Executing eventsAgent...");
    try {
      const result = await eventsAgent.execute({
        tripId: trip.id,
        destination: trip.destination,
        date: trip.start_date?.toISOString().split('T')[0]
      });

      previousToolResults.push({
        tool: eventsAgent.name,
        resultSummary: result.summary || "Events fetched",
        result
      });
      console.log("[Orchestrator] ✅ eventsAgent completed");
    } catch (error) {
      console.warn("[Orchestrator] ⚠️  eventsAgent failed:", error.message);
      previousToolResults.push({
        tool: eventsAgent.name,
        resultSummary: "Events fetch failed",
        error: error.message
      });
    }

    // ============================================
    // 5️⃣ ITINERARY AGENT (After weather + budget + events)
    // ============================================
    console.log("[Orchestrator] Executing itineraryAgent...");
    try {
      const days = Math.ceil(
        (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
      ) || 3;

      const budgetResult = previousToolResults.find(r => r.tool === budgetAgent.name)?.result;

      const result = await itineraryAgent.execute({
        tripId: trip.id,
        destination: trip.destination,
        days,
        startDate: trip.start_date?.toISOString().split('T')[0],
        adults: trip.adults || 1,
        children: trip.children || 0,
        budgetResult
      });

      previousToolResults.push({
        tool: itineraryAgent.name,
        resultSummary: result.summary || "Itinerary generated",
        result
      });
      console.log("[Orchestrator] ✅ itineraryAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ itineraryAgent failed:", error.message);
      previousToolResults.push({
        tool: itineraryAgent.name,
        resultSummary: "Itinerary generation failed",
        error: error.message
      });
    }

    // ============================================
    // 6️⃣ MAPS AGENT (After itinerary - routes between POIs)
    // ============================================
    console.log("[Orchestrator] Executing mapsAgent for routes...");
    try {
      const result = await mapsAgent.execute({
        tripId: trip.id,
        mode: "driving"
      });

      previousToolResults.push({
        tool: mapsAgent.name,
        resultSummary: result.summary || "Routes calculated",
        result
      });
      console.log("[Orchestrator] ✅ mapsAgent completed");
    } catch (error) {
      console.warn("[Orchestrator] ⚠️  mapsAgent failed:", error.message);
      previousToolResults.push({
        tool: mapsAgent.name,
        resultSummary: "Route calculation failed",
        error: error.message
      });
    }

    // ============================================
    // FINAL: Generate Summary
    // ============================================
    console.log("\n[Orchestrator] All agents completed. Generating final summary...");

    // Fetch complete itinerary from DB
    const itineraryItems = await prisma.itineraryItem.findMany({
      where: { trip_id: trip.id },
      orderBy: [{ day_number: "asc" }, { sort_order: "asc" }]
    });

    const successfulTools = previousToolResults.filter(r => !r.error).length;
    const totalTools = previousToolResults.length;

    const finalAnswer = {
      status: successfulTools === totalTools ? "COMPLETE_SUCCESS" : "PARTIAL_SUCCESS",
      message: `Trip planning completed with ${successfulTools}/${totalTools} tools successful`,
      tripSummary: {
        destination: trip.destination,
        duration: `${Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24))} days`,
        travelers: `${trip.adults || 1} adult(s)`,
        budget: previousToolResults.find(r => r.tool === budgetAgent.name)?.result?.budget || {}
      },
      itinerary: itineraryItems,
      toolResults: previousToolResults
    };

    console.log("\n=== Orchestrator Completed Successfully ===");
    return finalAnswer;

  } catch (error) {
    console.error("[Orchestrator] Critical error:", error.message);
    
    return {
      status: "FAILED",
      message: "Orchestrator failed to complete",
      error: error.message,
      toolResults: previousToolResults
    };
  }
}

export default runMCPOrchestrator;