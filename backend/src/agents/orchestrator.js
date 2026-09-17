import "dotenv/config";
import { generateGroqText } from "../config/groq.js";
import { weatherAgent } from "./weatherAgent.js";
import { budgetAgent } from "./budgetAgent.js";
import { eventsAgent } from "./eventsAgent.js";
import { itineraryAgent } from "./itineraryAgent.js";
import { mapsAgent } from "./mapsAgent.js";
import { flightAgent } from "./flightAgent.js";
import { newsAgent } from "./newsAgent.js";
import { reviewsAgent } from "./reviewsAgent.js";
import { destinationDiscoveryAgent } from "./destinationDiscoveryAgent.js";
import { hotelsAgent } from "./hotelsAgent.js";
import { trainAgent } from "./trainAgent.js";
import prisma from "../config/db.js";
import { createTravelMcpClient } from "../mcp/travelMcpClient.js";

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
   - Stores data in WeatherData model
   - This must complete before proceeding

2. **flightAgent** (REQUIRED)
   - Searches for available flights
   - Required inputs: origin, destination, departureDate, returnDate, adults, tripId
   - Stores results in Trip.flights_data (JSON)
   - Essential for trip planning and budget calculation

3. **trainAgent** (REQUIRED)
   - Searches for train options as an alternative to flights
   - Required inputs: origin, destination, departureDate, adults, tripId
   - Stores results in Trip.trains_data (JSON)
   - Runs after flights to provide transport alternatives

4. **hotelsAgent** (REQUIRED)
   - Searches for hotel accommodations
   - Required inputs: destination, checkin, checkout, adults, children, rooms, tripId
   - Stores results in Trip.hotels_data (JSON)
   - Critical for accommodation planning and budgeting

5. **newsAgent** (REQUIRED)
   - Fetches recent news about the destination
   - Required inputs: destination, tripId, maxResults, timeRange
   - Stores results in Trip.news_data (JSON)
   - Provides important safety and event information

6. **budgetAgent** (REQUIRED)
   - Calculates trip budget based on flights, trains, hotels, and activities
   - Required inputs: tripId
   - Uses Trip.flights_data, Trip.trains_data, Trip.hotels_data, and Event models
   - Stores results in BudgetItem model
   - Must run AFTER flights, trains, and hotels are fetched

7. **eventsAgent** (REQUIRED)
   - Finds local events and activities at the destination
   - Required inputs: tripId, destination, date
   - Stores results in Event model
   - Must run AFTER budget to align with spending capacity

8. **itineraryAgent** (REQUIRED)
   - Generates day-by-day itinerary with activities and POIs
   - Required inputs: tripId, destination, days, startDate, adults, children, budgetResult, eventsResult, hotelResult
   - Stores results in ItineraryItem model
   - Must run AFTER weather, budget, and events are available

9. **mapsAgent** (REQUIRED - ALWAYS LAST)
   - Calculates routes between origin and destination
   - Required inputs: tripId, action: "directions", mode (driving/walking/transit)
   - Stores results in Route model (transport_mode: specified mode)
   - Must run AFTER itinerary to calculate main route

## EXECUTION RULES
- **SEQUENTIAL EXECUTION**: Tools must be called in the order listed above
- **NO SKIPPING**: Every tool must be attempted, even if previous tools fail
- **DEPENDENCY AWARENESS**: Some tools require outputs from previous tools
- **ERROR HANDLING**: If a tool fails, log the error but continue with remaining tools
- **AGENT TASK LOGGING**: Store each tool's execution details in AgentTask model
- **COMPLETION**: Only declare success when ALL tools have been executed

## TOOL DEPENDENCY MAP
- weatherAgent → Independent
- flightAgent & trainAgent & hotelsAgent & newsAgent → Independent (can run after weather)
- budgetAgent → Depends on flightAgent, trainAgent, and hotelsAgent data
- eventsAgent → Depends on budgetAgent for budget constraints
- itineraryAgent → Depends on weatherAgent, budgetAgent, eventsAgent outputs
- mapsAgent → Calculates main route from origin to destination

## OUTPUT REQUIREMENTS
After executing all tools, you must provide:
1. Status summary (COMPLETE_SUCCESS if all tools succeeded, PARTIAL_SUCCESS if some failed)
2. Count of successful vs failed tools
3. Trip summary with destination, duration, travelers, and budget
4. Complete itinerary, weather, events, routes, and budget items from database
5. Detailed results from each tool execution (via AgentTask)

## ERROR HANDLING PROTOCOL
- If a tool fails: Log the error in AgentTask, mark it as failed, but CONTINUE
- If a critical tool fails (weather, flights, trains, budget): Still attempt remaining tools
- Never abort the entire orchestration due to single tool failure
- Always provide a final summary even if some tools failed

## QUALITY ASSURANCE
Before completing, verify:
✓ All tools were attempted
✓ Results stored in previousToolResults array
✓ AgentTask entries created for each tool
✓ Database updated with itinerary items, routes, budget items, etc.
✓ Final summary generated with all tool results
✓ Trip.summary field updated in database

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

async function storeTrainData(tripId, result) {
  console.log(`[Orchestrator] Train data processed for trip ${tripId}`);
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

  // ✅ CRITICAL: Clean up ALL previous data before starting
  console.log("[Orchestrator] 🧹 Cleaning up previous trip data...");
  try {
    const deleteCounts = await prisma.$transaction([
      prisma.route.deleteMany({ where: { trip_id: trip.id } }),
      prisma.event.deleteMany({ where: { trip_id: trip.id } }),
      prisma.itineraryItem.deleteMany({ where: { trip_id: trip.id } }),
      prisma.budgetItem.deleteMany({ where: { trip_id: trip.id } }),
      prisma.weatherData.deleteMany({ where: { trip_id: trip.id } }),
      prisma.agentTask.deleteMany({ where: { trip_id: trip.id } }),
    ]);
    
    console.log("[Orchestrator] ✅ Cleanup completed:");
    console.log(`  - Deleted ${deleteCounts[0].count} routes`);
    console.log(`  - Deleted ${deleteCounts[1].count} events`);
    console.log(`  - Deleted ${deleteCounts[2].count} itinerary items`);
    console.log(`  - Deleted ${deleteCounts[3].count} budget items`);
    console.log(`  - Deleted ${deleteCounts[4].count} weather data`);
    console.log(`  - Deleted ${deleteCounts[5].count} agent tasks\n`);
  } catch (cleanupError) {
    console.error("[Orchestrator] ⚠️ Cleanup failed:", cleanupError.message);
  }

  const previousToolResults = [];
  const collectedData = {
    flights: null,
    trains: null,
    hotels: null,
    news: null,
    reviews: null,
    discovery: null,
    weather: null,
    events: null,
    itinerary: null,
    budget: null,
    maps: null,
  };

  let successfulTools = 0;
  const totalTools = 11;
  const mcp = await createTravelMcpClient();

  try {
    console.log("[Orchestrator] Starting sequential tool execution...");

    // Helper to create AgentTask entry
    async function createAgentTask(agentName, taskData, status, result = null, error = null) {
      return prisma.agentTask.create({
        data: {
          trip_id: trip.id,
          agent_type: agentName,
          task_data: taskData,
          result_data: result,
          status,
          started_at: new Date(),
          completed_at: status === "SUCCESS" ? new Date() : null,
          error_message: error ? error.message : null,
        },
      });
    }

    // ============================================
    // 1️⃣ WEATHER AGENT
    // ============================================
    console.log("[Orchestrator] Executing weatherAgent...");
    try {
      const taskData = {
        tripId: trip.id,
        destination: trip.destination,
        startDate: trip.start_date?.toISOString().split("T")[0],
        endDate: trip.end_date?.toISOString().split("T")[0],
      };
      const result = await mcp.call(weatherAgent.name, taskData);
      await storeWeatherData(trip.id, result);
      await createAgentTask(weatherAgent.name, taskData, "SUCCESS", result);
      collectedData.weather = result;
      previousToolResults.push({
        tool: weatherAgent.name,
        status: "SUCCESS",
        resultSummary: result.summary || "Weather data fetched and stored",
        result,
      });
      successfulTools++;
      console.log("[Orchestrator] ✅ weatherAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ weatherAgent failed:", error.message);
      await createAgentTask(
        weatherAgent.name,
        {
          tripId: trip.id,
          destination: trip.destination,
          startDate: trip.start_date?.toISOString().split("T")[0],
          endDate: trip.end_date?.toISOString().split("T")[0],
        },
        "FAILED",
        null,
        error
      );
      previousToolResults.push({
        tool: weatherAgent.name,
        status: "FAILED",
        resultSummary: "Weather data fetch failed",
        error: error.message,
      });
    }

    // ============================================
    // 2️⃣ FLIGHT AGENT
    // ============================================
    console.log("[Orchestrator] Executing flightAgent...");
    try {
      const taskData = {
        origin: trip.origin,
        destination: trip.destination,
        departureDate: trip.start_date?.toISOString().split("T")[0],
        returnDate: trip.end_date?.toISOString().split("T")[0],
        adults: trip.adults || 1,
        currency: trip.summary?.currency || "INR",
        tripId: trip.id,
      };
      const result = await mcp.call(flightAgent.name, taskData);
      await storeFlightData(trip.id, result);
      
      // ✅ Store in Trip.flights_data instead of Route table
      await prisma.trip.update({
        where: { id: trip.id },
        data: { flights_data: result },
      });
      
      await createAgentTask(flightAgent.name, taskData, "SUCCESS", result);
      collectedData.flights = result;
      previousToolResults.push({
        tool: flightAgent.name,
        status: "SUCCESS",
        resultSummary: result.summary || "Flights found and stored",
        result,
      });
      successfulTools++;
      console.log("[Orchestrator] ✅ flightAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ flightAgent failed:", error.message);
      await createAgentTask(
        flightAgent.name,
        {
          origin: trip.origin,
          destination: trip.destination,
          departureDate: trip.start_date?.toISOString().split("T")[0],
          returnDate: trip.end_date?.toISOString().split("T")[0],
          adults: trip.adults || 1,
          tripId: trip.id,
        },
        "FAILED",
        null,
        error
      );
      previousToolResults.push({
        tool: flightAgent.name,
        status: "FAILED",
        resultSummary: "Flight search failed",
        error: error.message,
      });
    }

    // ============================================
    // 3️⃣ TRAIN AGENT
    // ============================================
    console.log("[Orchestrator] Executing trainAgent...");
    try {
      const taskData = {
        origin: trip.origin,
        destination: trip.destination,
        departureDate: trip.start_date?.toISOString().split("T")[0],
        adults: trip.adults || 1,
        tripId: trip.id,
      };
      const result = await mcp.call(trainAgent.name, taskData);
      await storeTrainData(trip.id, result);
      
      // ✅ Store in Trip.trains_data instead of Route table
      await prisma.trip.update({
        where: { id: trip.id },
        data: { trains_data: result },
      });
      
      await createAgentTask(trainAgent.name, taskData, "SUCCESS", result);
      collectedData.trains = result;
      previousToolResults.push({
        tool: trainAgent.name,
        status: "SUCCESS",
        resultSummary: result.summary || "Trains found and stored",
        result,
      });
      successfulTools++;
      console.log("[Orchestrator] ✅ trainAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ trainAgent failed:", error.message);
      await createAgentTask(
        trainAgent.name,
        {
          origin: trip.origin,
          destination: trip.destination,
          departureDate: trip.start_date?.toISOString().split("T")[0],
          adults: trip.adults || 1,
          tripId: trip.id,
        },
        "FAILED",
        null,
        error
      );
      previousToolResults.push({
        tool: trainAgent.name,
        status: "FAILED",
        resultSummary: "Train search failed",
        error: error.message,
      });
    }

    // ============================================
    // 4️⃣ HOTELS AGENT
    // ============================================
    console.log("[Orchestrator] Executing hotelsAgent...");
    try {
      const taskData = {
        destination: trip.destination,
        checkin: trip.start_date?.toISOString().split("T")[0],
        checkout: trip.end_date?.toISOString().split("T")[0],
        adults: trip.adults || 1,
        children: trip.children || 0,
        rooms: 1,
        currency: trip.summary?.currency || "INR",
        sortBy: "relevance",
        tripId: trip.id,
      };
      const result = await mcp.call(hotelsAgent.name, taskData);
      await prisma.trip.update({
        where: { id: trip.id },
        data: { hotels_data: result },
      });
      await createAgentTask(hotelsAgent.name, taskData, "SUCCESS", result);
      collectedData.hotels = result;
      previousToolResults.push({
        tool: hotelsAgent.name,
        status: "SUCCESS",
        resultSummary: result.summary || "Hotels fetched",
        result,
      });
      successfulTools++;
      console.log("[Orchestrator] ✅ hotelsAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ hotelsAgent failed:", error.message);
      await createAgentTask(
        hotelsAgent.name,
        {
          destination: trip.destination,
          checkin: trip.start_date?.toISOString().split("T")[0],
          checkout: trip.end_date?.toISOString().split("T")[0],
          adults: trip.adults || 1,
          children: trip.children || 0,
          rooms: 1,
          currency: trip.summary?.currency || "INR",
          sortBy: "relevance",
          tripId: trip.id,
        },
        "FAILED",
        null,
        error
      );
      previousToolResults.push({
        tool: hotelsAgent.name,
        status: "FAILED",
        resultSummary: "Hotel search failed",
        error: error.message,
      });
    }

    // ============================================
    // 5️⃣ NEWS AGENT
    // ============================================
    console.log("[Orchestrator] Executing newsAgent...");
    try {
      const taskData = {
        destination: trip.destination,
        tripId: trip.id,
        maxResults: 10,
        timeRange: "1m",
      };
      const result = await mcp.call(newsAgent.name, taskData);
      await prisma.trip.update({
        where: { id: trip.id },
        data: { news_data: result },
      });
      await createAgentTask(newsAgent.name, taskData, "SUCCESS", result);
      collectedData.news = result;
      previousToolResults.push({
        tool: newsAgent.name,
        status: "SUCCESS",
        resultSummary: result.summary || "News fetched",
        result,
      });
      successfulTools++;
      console.log("[Orchestrator] ✅ newsAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ newsAgent failed:", error.message);
      await createAgentTask(
        newsAgent.name,
        {
          destination: trip.destination,
          tripId: trip.id,
          maxResults: 10,
          timeRange: "1m",
        },
        "FAILED",
        null,
        error
      );
      previousToolResults.push({
        tool: newsAgent.name,
        status: "FAILED",
        resultSummary: "News fetch failed",
        error: error.message,
      });
    }

    // ============================================
    // 6️⃣ BUDGET AGENT
    // ============================================
    console.log("[Orchestrator] Executing reviewsAgent...");
    try {
      const taskData = { tripId: trip.id, destination: trip.destination, maxPlaces: 3 };
      const result = await mcp.call(reviewsAgent.name, taskData);
      await createAgentTask(reviewsAgent.name, taskData, "SUCCESS", result);
      collectedData.reviews = result;
      previousToolResults.push({ tool: reviewsAgent.name, status: "SUCCESS", resultSummary: result.summary, result });
      successfulTools++;
    } catch (error) {
      await createAgentTask(reviewsAgent.name, { tripId: trip.id, destination: trip.destination, maxPlaces: 3 }, "FAILED", null, error);
      previousToolResults.push({ tool: reviewsAgent.name, status: "FAILED", resultSummary: "Reviews search failed", error: error.message });
    }

    console.log("[Orchestrator] Executing destinationDiscoveryAgent...");
    try {
      const taskData = { tripId: trip.id, origin: trip.origin, departureDate: trip.start_date?.toISOString().slice(0, 10), returnDate: trip.end_date?.toISOString().slice(0, 10), currency: trip.summary?.currency || "INR" };
      const result = await mcp.call(destinationDiscoveryAgent.name, taskData);
      await createAgentTask(destinationDiscoveryAgent.name, taskData, "SUCCESS", result);
      collectedData.discovery = result;
      previousToolResults.push({ tool: destinationDiscoveryAgent.name, status: "SUCCESS", resultSummary: result.summary, result });
      successfulTools++;
    } catch (error) {
      await createAgentTask(destinationDiscoveryAgent.name, { tripId: trip.id, origin: trip.origin }, "FAILED", null, error);
      previousToolResults.push({ tool: destinationDiscoveryAgent.name, status: "FAILED", resultSummary: "Destination discovery failed", error: error.message });
    }

    console.log("[Orchestrator] Executing budgetAgent...");
    try {
      const taskData = { tripId: trip.id };
      const result = await mcp.call(budgetAgent.name, taskData);
      await createAgentTask(budgetAgent.name, taskData, "SUCCESS", result);
      collectedData.budget = result;
      previousToolResults.push({
        tool: budgetAgent.name,
        status: "SUCCESS",
        resultSummary: result.resultSummary || result.summary || "Budget calculated",
        result,
      });
      successfulTools++;
      console.log("[Orchestrator] ✅ budgetAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ budgetAgent failed:", error.message);
      await createAgentTask(budgetAgent.name, { tripId: trip.id }, "FAILED", null, error);
      previousToolResults.push({
        tool: budgetAgent.name,
        status: "FAILED",
        resultSummary: "Budget calculation failed",
        error: error.message,
      });
    }

    // ============================================
    // 7️⃣ EVENTS AGENT
    // ============================================
    console.log("[Orchestrator] Executing eventsAgent...");
    try {
      const taskData = {
        tripId: trip.id,
        destination: trip.destination,
        date: trip.start_date?.toISOString().split("T")[0],
      };
      const result = await mcp.call(eventsAgent.name, taskData);
      await storeEventsData(trip.id, result);
      
      // ✅ Clear old events before storing new ones
      await prisma.event.deleteMany({ where: { trip_id: trip.id } });
      
      // Store events in database
      for (const e of result.events || []) {
        await prisma.event.create({
          data: {
            trip_id: trip.id,
            title: e.name || "Unknown Event",
            description: e.description || "",
            location: e.location || trip.destination,
            start_datetime: e.start_time ? new Date(e.start_time) : new Date(),
            end_datetime: e.end_time ? new Date(e.end_time) : new Date(),
            category: e.category || "Event",
            price: e.price || 0,
            booking_url: e.url || null,
            is_recommended: e.is_recommended || false,
            relevance_score: e.relevance_score || 0,
            created_at: new Date(),
          },
        });
      }
      
      await createAgentTask(eventsAgent.name, taskData, "SUCCESS", result);
      collectedData.events = result;
      previousToolResults.push({
        tool: eventsAgent.name,
        status: "SUCCESS",
        resultSummary: result.summary || "Events fetched and stored",
        result,
      });
      successfulTools++;
      console.log("[Orchestrator] ✅ eventsAgent completed");
    } catch (error) {
      console.warn("[Orchestrator] ⚠️ eventsAgent failed:", error.message);
      await createAgentTask(
        eventsAgent.name,
        {
          tripId: trip.id,
          destination: trip.destination,
          date: trip.start_date?.toISOString().split("T")[0],
        },
        "FAILED",
        null,
        error
      );
      previousToolResults.push({
        tool: eventsAgent.name,
        status: "FAILED",
        resultSummary: "Events fetch failed",
        error: error.message,
      });
    }

    // ============================================
    // 8️⃣ ITINERARY AGENT
    // ============================================
    console.log("[Orchestrator] Executing itineraryAgent...");
    try {
      const days =
        Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)) ||
        3;
      const taskData = {
        tripId: trip.id,
        destination: trip.destination,
        days,
        startDate: trip.start_date?.toISOString().split("T")[0],
        adults: trip.adults || 1,
        children: trip.children || 0,
        budgetResult: collectedData.budget,
        eventsResult: collectedData.events,
        hotelResult: collectedData.hotels,
      };
      const result = await mcp.call(itineraryAgent.name, taskData);
      await storeItineraryData(trip.id, result);
      
      // itineraryAgent owns persistence of both the complete plan and its
      // day-level records. Re-writing here used to delete its just-created
      // records because `plan` is an array of days, not `{ items: [] }`.
      
      await createAgentTask(itineraryAgent.name, taskData, "SUCCESS", result);
      collectedData.itinerary = result;
      previousToolResults.push({
        tool: itineraryAgent.name,
        status: "SUCCESS",
        resultSummary: result.summary || "Itinerary generated and stored",
        result,
      });
      successfulTools++;
      console.log("[Orchestrator] ✅ itineraryAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ itineraryAgent failed:", error.message);
      const days =
        Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)) ||
        3;
      await createAgentTask(
        itineraryAgent.name,
        {
          tripId: trip.id,
          destination: trip.destination,
          days,
          startDate: trip.start_date?.toISOString().split("T")[0],
          adults: trip.adults || 1,
          children: trip.children || 0,
        },
        "FAILED",
        null,
        error
      );
      previousToolResults.push({
        tool: itineraryAgent.name,
        status: "FAILED",
        resultSummary: "Itinerary generation failed",
        error: error.message,
      });
    }

    // ============================================
    // 9️⃣ MAPS AGENT
    // ============================================
    console.log("[Orchestrator] Executing mapsAgent...");
    try {
      const taskData = { 
        tripId: trip.id, 
        action: "directions",  // ✅ Explicitly set action
        mode: "driving" 
      };
      
      // ✅ mapsAgent.execute() already saves the route to database
      // We don't need to save it again here
      const result = await mcp.call(mapsAgent.name, taskData);

      await createAgentTask(mapsAgent.name, taskData, "SUCCESS", result);
      collectedData.maps = result;
      
      previousToolResults.push({
        tool: mapsAgent.name,
        status: "SUCCESS",
        resultSummary: result.summary || "Routes calculated",
        result,
      });
      successfulTools++;
      console.log("[Orchestrator] ✅ mapsAgent completed");
      console.log(`[Orchestrator] Route saved with ID: ${result.id}`);
    } catch (error) {
      console.warn("[Orchestrator] ⚠️ mapsAgent failed:", error.message);
      await createAgentTask(
        mapsAgent.name,
        { tripId: trip.id, action: "directions", mode: "driving" },
        "FAILED",
        null,
        error
      );
      previousToolResults.push({
        tool: mapsAgent.name,
        status: "FAILED",
        resultSummary: "Route calculation failed",
        error: error.message,
      });
    }

    // ============================================
    // FINAL: Generate Summary and Response
    // ============================================
    console.log("\n[Orchestrator] All agents completed. Generating final summary...");

    // Fetch final data from database
    const [dbItinerary, dbWeather, dbEvents, dbBudgetItems, dbRoutes, dbAgentTasks, tripData] =
      await Promise.all([
        prisma.itineraryItem.findMany({
          where: { trip_id: trip.id },
          orderBy: [{ day_number: "asc" }, { sort_order: "asc" }],
        }),
        prisma.weatherData.findMany({
          where: { trip_id: trip.id },
          orderBy: { date: "asc" },
        }),
        prisma.event.findMany({
          where: { trip_id: trip.id },
          orderBy: { start_datetime: "asc" },
        }),
        prisma.budgetItem.findMany({
          where: { trip_id: trip.id },
          orderBy: { category: "asc" },
        }),
        prisma.route.findMany({
          where: { trip_id: trip.id },
          orderBy: { created_at: "asc" },
        }),
        prisma.agentTask.findMany({
          where: { trip_id: trip.id },
          orderBy: { started_at: "asc" },
        }),
        prisma.trip.findUnique({
          where: { id: trip.id },
          select: {
            flights_data: true,
            trains_data: true,
            hotels_data: true,
            news_data: true,
            total_budget: true,
            summary: true,
            destination_coords: true,
          },
        }),
      ]);

    // Generate AI summary
    let aiGeneratedInsights = "";
    try {
      const summaryPrompt = `Based on the following tool execution results, provide a brief, friendly summary for the traveler:

${JSON.stringify(
  previousToolResults.map((r) => ({
    tool: r.tool,
    status: r.status,
    summary: r.resultSummary,
  })),
  null,
  2
)}

Trip Details:
- Destination: ${trip.destination}
- Duration: ${Math.ceil(
  (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
)} days
- Travelers: ${trip.adults || 1} adult(s)${trip.children ? `, ${trip.children} child(ren)` : ""}

Provide a 2-3 sentence summary highlighting the key planning achievements and any important notes.`;

      aiGeneratedInsights = await generateGroqText(
        "You are a travel assistant. Provide concise, helpful travel planning summaries.",
        summaryPrompt,
        0.3
      );
      console.log("[Orchestrator] AI Summary Generated:", aiGeneratedInsights);
    } catch (error) {
      console.warn("[Orchestrator] AI summary generation failed:", error.message);
      aiGeneratedInsights = "Trip planning completed with available data.";
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
        duration: `${Math.ceil(
          (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
        )} days`,
        travelers: `${trip.adults || 1} adult(s)${
          trip.children ? `, ${trip.children} child(ren)` : ""
        }`,
        totalBudget:
          tripData?.total_budget ||
          collectedData.budget?.result?.budget?.total ||
          collectedData.budget?.budget?.total|| 0,
        status: "PLANNING_COMPLETED",
      },
      itinerary: dbItinerary,
      weather: dbWeather,
      events: dbEvents,
      budgetItems: dbBudgetItems,
      routes: dbRoutes,
      agentTasks: dbAgentTasks,
      flights: tripData?.flights_data,
      trains: tripData?.trains_data,
      hotels: tripData?.hotels_data,
      news: tripData?.news_data,
      toolResults: previousToolResults,
      executionMetadata: {
        totalTools,
        successfulTools,
        failedTools: totalTools - successfulTools,
        executionTime: new Date().toISOString(),
      },
    };

    // Update trip status in database
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: "COMPLETED",
        summary: {
          totalBudget:
            collectedData.budget?.result?.budget?.total ||
            collectedData.budget?.budget?.total ||
            tripData?.total_budget ||
            0,
          duration: finalAnswer.tripSummary.duration,
          highlights: dbItinerary.map((i) => i.title).join(", ") || "Trip planned",
          recommendation: aiGeneratedInsights,
        },
        total_budget:
          collectedData.budget?.result?.budget?.total ||
          collectedData.budget?.budget?.total ||
          tripData?.total_budget ||
          0,
      },
    });

    console.log("\n=== Orchestrator Completed Successfully ===");
    console.log(`[Orchestrator] Status: ${finalAnswer.status}`);
    console.log(`[Orchestrator] Success Rate: ${successfulTools}/${totalTools}`);
    console.log(`[Orchestrator] Total Routes Created: ${dbRoutes.length}`);
    console.log(`[Orchestrator] Total Itinerary Items: ${dbItinerary.length}`);
    console.log(`[Orchestrator] Total Events: ${dbEvents.length}`);
    console.log(`[Orchestrator] Total Budget Items: ${dbBudgetItems.length}`);

    await mcp.close();
    return finalAnswer;
  } catch (error) {
    console.error("[Orchestrator] Critical error:", error.message);
    console.error("[Orchestrator] Stack trace:", error.stack);

    const errorResponse = {
      status: "FAILED",
      message: "Orchestrator failed to complete",
      error: error.message,
      stack: error.stack,
      partialData: collectedData,
      toolResults: previousToolResults,
      timestamps: {
        planningStarted: new Date().toISOString(),
        errorOccurred: new Date().toISOString(),
      },
    };

    // Update trip with error status
    try {
      await prisma.trip.update({
        where: { id: trip.id },
        data: {
          status: "FAILED",
          summary: {
            totalBudget: collectedData.budget?.result?.budget?.total || 0,
            duration: `${Math.ceil(
              (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
            )} days`,
            highlights: "Trip planning failed",
            recommendation: "Unable to complete planning due to an error.",
            error: error.message,
          },
        },
      });
    } catch (updateError) {
      console.error("[Orchestrator] Failed to update trip with error status:", updateError.message);
    }

    await mcp.close();
    return errorResponse;
  }
}

// --------------------
// Export
// --------------------
export default runMCPOrchestrator;
export { ORCHESTRATOR_SYSTEM_PROMPT };
