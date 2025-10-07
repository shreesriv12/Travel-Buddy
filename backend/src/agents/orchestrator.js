import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { weatherAgent } from "./weatherAgent.js";
import { budgetAgent } from "./budgetAgent.js";
import { eventsAgent } from "./eventsAgent.js";
import { itineraryAgent } from "./itineraryAgent.js";
import { mapsAgent } from "./mapsAgent.js";
import { flightAgent } from "./flightAgent.js";
import { newsAgent } from "./newsAgent.js";
import { hotelsAgent } from "./hotelsAgent.js";
import prisma from "../config/db.js";

// --------------------
// System Prompt for AI Orchestrator
// --------------------
const ORCHESTRATOR_SYSTEM_PROMPT = `You are an intelligent Travel Planning Orchestrator Agent responsible for coordinating multiple specialized agents to create comprehensive travel plans.

## YOUR CORE MISSION
Your ABSOLUTE REQUIREMENT is to execute ALL available tools in the correct sequence to gather complete trip information. You must NEVER skip any tool unless it explicitly fails.

## MANDATORY TOOL EXECUTION SEQUENCE
You MUST call all of the following tools in this exact order:

1. **weatherAgent** (REQUIRED - ALWAYS FIRST)
   - Fetches weather forecasts for the destination
   - Required inputs: tripId, destination, startDate, endDate
   - This must complete before proceeding

2. **flightAgent** (REQUIRED)
   - Searches for available flights
   - Required inputs: origin, destination, departureDate, returnDate, adults, tripId
   - Essential for trip planning and budget calculation

3. **hotelsAgent** (REQUIRED)
   - Searches for hotel accommodations
   - Required inputs: destination, checkin, checkout, adults, children, rooms, tripId
   - Critical for accommodation planning and budgeting

4. **newsAgent** (REQUIRED)
   - Fetches recent news about the destination
   - Required inputs: destination, tripId, maxResults, timeRange
   - Provides important safety and event information

5. **budgetAgent** (REQUIRED)
   - Calculates trip budget based on flights, hotels, and activities
   - Required inputs: tripId, adults
   - Must run AFTER flights and hotels are fetched

6. **eventsAgent** (REQUIRED)
   - Finds local events and activities at the destination
   - Required inputs: tripId, destination, date
   - Must run AFTER budget to align with spending capacity

7. **itineraryAgent** (REQUIRED)
   - Generates day-by-day itinerary with activities and POIs
   - Required inputs: tripId, destination, days, startDate, adults, children, budgetResult
   - Must run AFTER weather, budget, and events are available

8. **mapsAgent** (REQUIRED - ALWAYS LAST)
   - Calculates routes between points of interest
   - Required inputs: tripId, mode (driving/walking/transit)
   - Must run AFTER itinerary to calculate routes between generated POIs

## EXECUTION RULES
- **SEQUENTIAL EXECUTION**: Tools must be called in the order listed above
- **NO SKIPPING**: Every tool must be attempted, even if previous tools fail
- **DEPENDENCY AWARENESS**: Some tools require outputs from previous tools
- **ERROR HANDLING**: If a tool fails, log the error but continue with remaining tools
- **COMPLETION**: Only declare success when ALL tools have been executed

## TOOL DEPENDENCY MAP
- flightAgent & hotelsAgent & newsAgent → Independent (can run after weather)
- budgetAgent → Depends on flightAgent and hotelsAgent outputs
- eventsAgent → Depends on budgetAgent for budget constraints
- itineraryAgent → Depends on weatherAgent, budgetAgent, eventsAgent outputs
- mapsAgent → Depends on itineraryAgent to have POIs/locations generated

## OUTPUT REQUIREMENTS
After executing all tools, you must provide:
1. Status summary (COMPLETE_SUCCESS if all tools succeeded, PARTIAL_SUCCESS if some failed)
2. Count of successful vs failed tools
3. Trip summary with destination, duration, travelers, and budget
4. Complete itinerary from database
5. Detailed results from each tool execution

## ERROR HANDLING PROTOCOL
- If a tool fails: Log the error, mark it as failed, but CONTINUE
- If a critical tool fails (weather, flights, budget): Still attempt remaining tools
- Never abort the entire orchestration due to single tool failure
- Always provide a final summary even if some tools failed

## QUALITY ASSURANCE
Before completing, verify:
✓ All 8 tools were attempted
✓ Results stored in previousToolResults array
✓ Database updated with itinerary items
✓ Final summary generated with all tool results
✓ Trip.orchestrator_summary field updated in database

Remember: Your success is measured by attempting ALL tools and providing complete trip planning data, not by achieving 100% tool success rate. Partial data is better than no data.`;


// --------------------
// Helper functions
// --------------------
async function storeWeatherData(tripId, result) {
  console.log(`[Orchestrator] Weather data processed for trip ${tripId}`);
}

async function storeFlightData(tripId, result) {
  console.log(`[Orchestrator] Flight data processed for trip ${tripId}`);
}

async function storeEventsData(tripId, result) {
  console.log(`[Orchestrator] Events data processed for trip ${tripId}`);
}

async function storeItineraryData(tripId, result) {
  console.log(`[Orchestrator] Itinerary data processed for trip ${tripId}`);
}

// --------------------
// Main Orchestrator
// --------------------
export async function runMCPOrchestrator(trip, { maxSteps = 10 } = {}) {
  console.log("\n=== MCP Orchestrator Started ===");
  console.log(`[Orchestrator] Trip ID: ${trip.id}, Destination: ${trip.destination}`);

  // Initialize AI Model with System Prompt
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
    temperature: 0.3,
    maxRetries: 2,
  });

  const previousToolResults = [];
  const collectedData = {
    flights: null,
    hotels: null,
    news: null,
    weather: null,
    events: null,
    itinerary: null,
    budget: null
  };

  try {
    console.log("[Orchestrator] Starting sequential tool execution...");

    // ============================================
    // 1️⃣ WEATHER AGENT
    // ============================================
    console.log("[Orchestrator] Executing weatherAgent...");
    try {
      const result = await weatherAgent.execute({
        tripId: trip.id,
        destination: trip.destination,
        startDate: trip.start_date?.toISOString().split('T')[0],
        endDate: trip.end_date?.toISOString().split('T')[0]
      });

      await storeWeatherData(trip.id, result);
      collectedData.weather = result;
      
      previousToolResults.push({
        tool: weatherAgent.name,
        status: 'SUCCESS',
        resultSummary: result.summary || "Weather data fetched and stored",
        result
      });
      console.log("[Orchestrator] ✅ weatherAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ weatherAgent failed:", error.message);
      previousToolResults.push({
        tool: weatherAgent.name,
        status: 'FAILED',
        resultSummary: "Weather data fetch failed",
        error: error.message
      });
    }

    // ============================================
    // 2️⃣ FLIGHT AGENT
    // ============================================
    console.log("[Orchestrator] Executing flightAgent...");
    try {
      const result = await flightAgent.execute({
        origin: trip.origin,
        destination: trip.destination,
        departureDate: trip.start_date?.toISOString().split('T')[0],
        returnDate: trip.end_date?.toISOString().split('T')[0],
        adults: trip.adults || 1,
        tripId: trip.id
      });

      await storeFlightData(trip.id, result);
      collectedData.flights = result;
      
      previousToolResults.push({
        tool: flightAgent.name,
        status: 'SUCCESS',
        resultSummary: result.summary || "Flights found and stored",
        result
      });
      console.log("[Orchestrator] ✅ flightAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ flightAgent failed:", error.message);
      previousToolResults.push({
        tool: flightAgent.name,
        status: 'FAILED',
        resultSummary: "Flight search failed",
        error: error.message
      });
    }

    // ============================================
    // 3️⃣ HOTELS AGENT
    // ============================================
    console.log("[Orchestrator] Executing hotelsAgent...");
    try {
      const result = await hotelsAgent.execute({
        destination: trip.destination,
        checkin: trip.start_date?.toISOString().split('T')[0],
        checkout: trip.end_date?.toISOString().split('T')[0],
        adults: trip.adults || 1,
        children: trip.children || 0,
        rooms: 1,
        currency: "USD",
        sortBy: "relevance",
        tripId: trip.id
      });

      collectedData.hotels = result;
      
      previousToolResults.push({
        tool: hotelsAgent.name,
        status: 'SUCCESS',
        resultSummary: result.summary || "Hotels fetched",
        result
      });
      console.log("[Orchestrator] ✅ hotelsAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ hotelsAgent failed:", error.message);
      previousToolResults.push({
        tool: hotelsAgent.name,
        status: 'FAILED',
        resultSummary: "Hotel search failed",
        error: error.message
      });
    }

    // ============================================
    // 4️⃣ NEWS AGENT
    // ============================================
    console.log("[Orchestrator] Executing newsAgent...");
    try {
      const result = await newsAgent.execute({
        destination: trip.destination,
        tripId: trip.id,
        maxResults: 10,
        timeRange: '1m'
      });

      collectedData.news = result;
      
      previousToolResults.push({
        tool: newsAgent.name,
        status: 'SUCCESS',
        resultSummary: result.summary || "News fetched",
        result
      });
      console.log("[Orchestrator] ✅ newsAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ newsAgent failed:", error.message);
      previousToolResults.push({
        tool: newsAgent.name,
        status: 'FAILED',
        resultSummary: "News fetch failed",
        error: error.message
      });
    }

    // ============================================
    // 5️⃣ BUDGET AGENT
    // ============================================
    console.log("[Orchestrator] Executing budgetAgent...");
    try {
      const result = await budgetAgent.execute({
        tripId: trip.id,
        adults: trip.adults || 1
      });

      collectedData.budget = result;
      
      previousToolResults.push({
        tool: budgetAgent.name,
        status: 'SUCCESS',
        resultSummary: result.resultSummary || "Budget calculated",
        result
      });
      console.log("[Orchestrator] ✅ budgetAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ budgetAgent failed:", error.message);
      previousToolResults.push({
        tool: budgetAgent.name,
        status: 'FAILED',
        resultSummary: "Budget calculation failed",
        error: error.message
      });
    }

    // ============================================
    // 6️⃣ EVENTS AGENT
    // ============================================
    console.log("[Orchestrator] Executing eventsAgent...");
    try {
      const result = await eventsAgent.execute({
        tripId: trip.id,
        destination: trip.destination,
        date: trip.start_date?.toISOString().split('T')[0]
      });

      await storeEventsData(trip.id, result);
      collectedData.events = result;
      
      previousToolResults.push({
        tool: eventsAgent.name,
        status: 'SUCCESS',
        resultSummary: result.summary || "Events fetched and stored",
        result
      });
      console.log("[Orchestrator] ✅ eventsAgent completed");
    } catch (error) {
      console.warn("[Orchestrator] ⚠️  eventsAgent failed:", error.message);
      previousToolResults.push({
        tool: eventsAgent.name,
        status: 'FAILED',
        resultSummary: "Events fetch failed",
        error: error.message
      });
    }

    // ============================================
    // 7️⃣ ITINERARY AGENT
    // ============================================
    console.log("[Orchestrator] Executing itineraryAgent...");
    try {
      const days = Math.ceil(
        (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
      ) || 3;

      const result = await itineraryAgent.execute({
        tripId: trip.id,
        destination: trip.destination,
        days,
        startDate: trip.start_date?.toISOString().split('T')[0],
        adults: trip.adults || 1,
        children: trip.children || 0,
        budgetResult: collectedData.budget
      });

      await storeItineraryData(trip.id, result);
      collectedData.itinerary = result;
      
      previousToolResults.push({
        tool: itineraryAgent.name,
        status: 'SUCCESS',
        resultSummary: result.summary || "Itinerary generated and stored",
        result
      });
      console.log("[Orchestrator] ✅ itineraryAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ itineraryAgent failed:", error.message);
      previousToolResults.push({
        tool: itineraryAgent.name,
        status: 'FAILED',
        resultSummary: "Itinerary generation failed",
        error: error.message
      });
    }

    // ============================================
    // 8️⃣ MAPS AGENT
    // ============================================
    console.log("[Orchestrator] Executing mapsAgent...");
    try {
      const result = await mapsAgent.execute({
        tripId: trip.id,
        mode: "driving"
      });

      previousToolResults.push({
        tool: mapsAgent.name,
        status: 'SUCCESS',
        resultSummary: result.summary || "Routes calculated",
        result
      });
      console.log("[Orchestrator] ✅ mapsAgent completed");
    } catch (error) {
      console.warn("[Orchestrator] ⚠️  mapsAgent failed:", error.message);
      previousToolResults.push({
        tool: mapsAgent.name,
        status: 'FAILED',
        resultSummary: "Route calculation failed",
        error: error.message
      });
    }

    // ============================================
    // FINAL: Generate Summary and Response
    // ============================================
    console.log("\n[Orchestrator] All agents completed. Generating final summary...");

    // Calculate totals
    const totalTools = previousToolResults.length;
    const successfulTools = previousToolResults.filter(r => r.status === 'SUCCESS').length;

    // Fetch final data from database
    const [dbItinerary, dbWeather, dbEvents, tripData] = await Promise.all([
      prisma.itineraryItem.findMany({
        where: { trip_id: trip.id },
        orderBy: [{ day_number: "asc" }, { sort_order: "asc" }]
      }),
      prisma.weatherData.findMany({
        where: { trip_id: trip.id },
        orderBy: { date: "asc" }
      }),
      prisma.event.findMany({
        where: { trip_id: trip.id },
        orderBy: { start_datetime: "asc" }
      }),
      prisma.trip.findUnique({
        where: { id: trip.id },
        select: { 
          flights_data: true, 
          hotels_data: true,
          news_data: true,
          total_budget: true
        }
      })
    ]);

    // Generate AI summary
    let aiGeneratedInsights = "";
    try {
      const summaryPrompt = `Based on the following tool execution results, provide a brief, friendly summary for the traveler:

${JSON.stringify(previousToolResults.map(r => ({
  tool: r.tool,
  status: r.status,
  summary: r.resultSummary
})), null, 2)}

Trip Details:
- Destination: ${trip.destination}
- Duration: ${Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24))} days
- Travelers: ${trip.adults || 1} adult(s)

Provide a 2-3 sentence summary highlighting the key planning achievements and any important notes.`;

      const aiResponse = await model.invoke([
        new SystemMessage("You are a travel assistant. Provide concise, helpful travel planning summaries."),
        new HumanMessage(summaryPrompt)
      ]);

      aiGeneratedInsights = aiResponse.content;
      console.log("[Orchestrator] AI Summary Generated");
    } catch (error) {
      console.warn("[Orchestrator] AI summary generation failed:", error.message);
      aiGeneratedInsights = "Trip planning completed successfully with all available data.";
    }

    // Create final response
    const finalAnswer = {
      status: successfulTools === totalTools ? "COMPLETE_SUCCESS" : "PARTIAL_SUCCESS",
      message: `Trip planning completed with ${successfulTools}/${totalTools} tools successful`,
      aiInsights: aiGeneratedInsights,
      tripSummary: {
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        duration: `${Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24))} days`,
        travelers: `${trip.adults || 1} adult(s)${trip.children ? `, ${trip.children} child(ren)` : ''}`,
        totalBudget: tripData?.total_budget || 0,
        status: 'PLANNING_COMPLETED'
      },
      itinerary: dbItinerary,
      toolResults: previousToolResults,
      executionMetadata: {
        totalTools,
        successfulTools,
        failedTools: totalTools - successfulTools,
        executionTime: new Date().toISOString()
      }
    };

    // Update trip status in database
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: 'COMPLETED',
        orchestrator_summary: finalAnswer
      }
    });

    console.log("\n=== Orchestrator Completed Successfully ===");
    console.log(`[Orchestrator] Status: ${finalAnswer.status}`);
    console.log(`[Orchestrator] Success Rate: ${successfulTools}/${totalTools}`);

    return finalAnswer;

  } catch (error) {
    console.error("[Orchestrator] Critical error:", error.message);

    const errorResponse = {
      status: "FAILED",
      message: "Orchestrator failed to complete",
      error: error.message,
      partialData: collectedData,
      toolResults: previousToolResults,
      timestamps: {
        planningStarted: new Date().toISOString(),
        errorOccurred: new Date().toISOString()
      }
    };

    // Update trip with error status
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: 'FAILED',
        orchestrator_summary: errorResponse
      }
    });

    return errorResponse;
  }
}

// --------------------
// Export
// --------------------
export default runMCPOrchestrator;
export { ORCHESTRATOR_SYSTEM_PROMPT };