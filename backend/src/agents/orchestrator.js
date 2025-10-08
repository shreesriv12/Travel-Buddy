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
import { trainAgent } from "./trainAgent.js";
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
   - Stores data in WeatherData model
   - This must complete before proceeding

2. **flightAgent** (REQUIRED)
   - Searches for available flights
   - Required inputs: origin, destination, departureDate, returnDate, adults, tripId
   - Stores results in Route model (transport_mode: "flight")
   - Essential for trip planning and budget calculation

2.5. **trainAgent** (REQUIRED)
   - Searches for train options as an alternative to flights
   - Required inputs: origin, destination, departureDate, adults, tripId
   - Stores results in Route model (transport_mode: "train")
   - Runs after flights to provide transport alternatives

3. **hotelsAgent** (REQUIRED)
   - Searches for hotel accommodations
   - Required inputs: destination, checkin, checkout, adults, children, rooms, tripId
   - Stores results in Trip.hotels_data (JSON)
   - Critical for accommodation planning and budgeting

4. **newsAgent** (REQUIRED)
   - Fetches recent news about the destination
   - Required inputs: destination, tripId, maxResults, timeRange
   - Stores results in Trip.news_data (JSON)
   - Provides important safety and event information

5. **budgetAgent** (REQUIRED)
   - Calculates trip budget based on flights, trains, hotels, and activities
   - Required inputs: tripId
   - Uses Route (flights/trains), Trip.hotels_data, and Event models
   - Stores results in BudgetItem model
   - Must run AFTER flights, trains, and hotels are fetched

6. **eventsAgent** (REQUIRED)
   - Finds local events and activities at the destination
   - Required inputs: tripId, destination, date
   - Stores results in Event model
   - Must run AFTER budget to align with spending capacity

7. **itineraryAgent** (REQUIRED)
   - Generates day-by-day itinerary with activities and POIs
   - Required inputs: tripId, destination, days, startDate, adults, children, budgetResult, eventsResult, hotelResult
   - Stores results in ItineraryItem model
   - Must run AFTER weather, budget, and events are available

8. **mapsAgent** (REQUIRED - ALWAYS LAST)
   - Calculates routes between points of interest
   - Required inputs: tripId, mode (driving/walking/transit)
   - Stores results in Route model (transport_mode: specified mode)
   - Must run AFTER itinerary to calculate routes between generated POIs

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
- budgetAgent → Depends on flightAgent (Route), trainAgent (Route), and hotelsAgent (Trip.hotels_data)
- eventsAgent → Depends on budgetAgent for budget constraints
- itineraryAgent → Depends on weatherAgent, budgetAgent, eventsAgent outputs
- mapsAgent → Depends on itineraryAgent to have POIs/locations generated

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
✓ Trip.summary and Trip.orchestrator_summary fields updated in database

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

  // Initialize AI Model with System Prompt
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-pro",
    temperature: 0.3,
    maxRetries: 2,
  });

  const previousToolResults = [];
  const collectedData = {
    flights: null,
    trains: null,
    hotels: null,
    news: null,
    weather: null,
    events: null,
    itinerary: null,
    budget: null,
  };

  let successfulTools = 0;
  const totalTools = 8;

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
      const result = await weatherAgent.execute(taskData);
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
      await createAgentTask(weatherAgent.name, {
        tripId: trip.id,
        destination: trip.destination,
        startDate: trip.start_date?.toISOString().split("T")[0],
        endDate: trip.end_date?.toISOString().split("T")[0],
      }, "FAILED", null, error);
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
        tripId: trip.id,
      };
      const result = await flightAgent.execute(taskData);
      await storeFlightData(trip.id, result);
      await prisma.route.deleteMany({ where: { trip_id: trip.id, transport_mode: "flight" } });
      for (const flight of result.bestFlights || []) {
        await prisma.route.create({
          data: {
            trip_id: trip.id,
            from_location: trip.origin,
            to_location: trip.destination,
            transport_mode: "flight",
            distance_km: flight.distance || 0,
            duration_minutes: flight.duration || 0,
            estimated_cost: flight.price || 0,
            route_data: flight,
            created_at: new Date(),
          },
        });
      }
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
      await createAgentTask(flightAgent.name, {
        origin: trip.origin,
        destination: trip.destination,
        departureDate: trip.start_date?.toISOString().split("T")[0],
        returnDate: trip.end_date?.toISOString().split("T")[0],
        adults: trip.adults || 1,
        tripId: trip.id,
      }, "FAILED", null, error);
      previousToolResults.push({
        tool: flightAgent.name,
        status: "FAILED",
        resultSummary: "Flight search failed",
        error: error.message,
      });
    }

    // ============================================
    // 2.5️⃣ TRAIN AGENT
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
      const result = await trainAgent.execute(taskData);
      await storeTrainData(trip.id, result);
      await prisma.route.deleteMany({ where: { trip_id: trip.id, transport_mode: "train" } });
      for (const route of result.routes || []) {
        await prisma.route.create({
          data: {
            trip_id: trip.id,
            from_location: trip.origin,
            to_location: trip.destination,
            transport_mode: "train",
            distance_km: route.distance ? parseFloat(route.distance) || 0 : 0,
            duration_minutes: route.duration ? parseInt(route.duration) || 0 : 0,
            estimated_cost: route.cost || 0,
            route_data: route,
            created_at: new Date(),
          },
        });
      }
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
      await createAgentTask(trainAgent.name, {
        origin: trip.origin,
        destination: trip.destination,
        departureDate: trip.start_date?.toISOString().split("T")[0],
        adults: trip.adults || 1,
        tripId: trip.id,
      }, "FAILED", null, error);
      previousToolResults.push({
        tool: trainAgent.name,
        status: "FAILED",
        resultSummary: "Train search failed",
        error: error.message,
      });
    }

    // ============================================
    // 3️⃣ HOTELS AGENT
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
        currency: "USD",
        sortBy: "relevance",
        tripId: trip.id,
      };
      const result = await hotelsAgent.execute(taskData);
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
      await createAgentTask(hotelsAgent.name, {
        destination: trip.destination,
        checkin: trip.start_date?.toISOString().split("T")[0],
        checkout: trip.end_date?.toISOString().split("T")[0],
        adults: trip.adults || 1,
        children: trip.children || 0,
        rooms: 1,
        currency: "USD",
        sortBy: "relevance",
        tripId: trip.id,
      }, "FAILED", null, error);
      previousToolResults.push({
        tool: hotelsAgent.name,
        status: "FAILED",
        resultSummary: "Hotel search failed",
        error: error.message,
      });
    }

    // ============================================
    // 4️⃣ NEWS AGENT
    // ============================================
    console.log("[Orchestrator] Executing newsAgent...");
    try {
      const taskData = {
        destination: trip.destination,
        tripId: trip.id,
        maxResults: 10,
        timeRange: "1m",
      };
      const result = await newsAgent.execute(taskData);
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
      await createAgentTask(newsAgent.name, {
        destination: trip.destination,
        tripId: trip.id,
        maxResults: 10,
        timeRange: "1m",
      }, "FAILED", null, error);
      previousToolResults.push({
        tool: newsAgent.name,
        status: "FAILED",
        resultSummary: "News fetch failed",
        error: error.message,
      });
    }

    // ============================================
    // 5️⃣ BUDGET AGENT
    // ============================================
    console.log("[Orchestrator] Executing budgetAgent...");
    try {
      const taskData = { tripId: trip.id };
      const result = await budgetAgent.execute(taskData);
      await createAgentTask(budgetAgent.name, taskData, "SUCCESS", result);
      collectedData.budget = result;
      previousToolResults.push({
        tool: budgetAgent.name,
        status: "SUCCESS",
        resultSummary: result.resultSummary || "Budget calculated",
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
    // 6️⃣ EVENTS AGENT
    // ============================================
    console.log("[Orchestrator] Executing eventsAgent...");
    try {
      const taskData = {
        tripId: trip.id,
        destination: trip.destination,
        date: trip.start_date?.toISOString().split("T")[0],
      };
      const result = await eventsAgent.execute(taskData);
      await storeEventsData(trip.id, result);
      await prisma.event.deleteMany({ where: { trip_id: trip.id } });
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
      await createAgentTask(eventsAgent.name, {
        tripId: trip.id,
        destination: trip.destination,
        date: trip.start_date?.toISOString().split("T")[0],
      }, "FAILED", null, error);
      previousToolResults.push({
        tool: eventsAgent.name,
        status: "FAILED",
        resultSummary: "Events fetch failed",
        error: error.message,
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
      const result = await itineraryAgent.execute(taskData);
      await storeItineraryData(trip.id, result);
      await prisma.itineraryItem.deleteMany({ where: { trip_id: trip.id } });
      for (const item of result.plan?.items || []) {
        await prisma.itineraryItem.create({
          data: {
            trip_id: trip.id,
            day_number: item.day_number || 1,
            title: item.title || "Activity",
            description: item.description || "",
            start_time: item.start_time ? new Date(item.start_time) : new Date(),
            end_time: item.end_time ? new Date(item.end_time) : new Date(),
            location: item.location || trip.destination,
            location_coords: item.location_coords || trip.destination_coords || {},
            category: item.category || "Activity",
            estimated_cost: item.estimated_cost || 0,
            sort_order: item.sort_order || 0,
            created_at: new Date(),
          },
        });
      }
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
      await createAgentTask(itineraryAgent.name, {
        tripId: trip.id,
        destination: trip.destination,
        days,
        startDate: trip.start_date?.toISOString().split("T")[0],
        adults: trip.adults || 1,
        children: trip.children || 0,
      }, "FAILED", null, error);
      previousToolResults.push({
        tool: itineraryAgent.name,
        status: "FAILED",
        resultSummary: "Itinerary generation failed",
        error: error.message,
      });
    }

    // ============================================
    // 8️⃣ MAPS AGENT
    // ============================================
    console.log("[Orchestrator] Executing mapsAgent...");
    try {
      const taskData = { tripId: trip.id, mode: "driving" };
      const result = await mapsAgent.execute(taskData);
      await prisma.route.deleteMany({ where: { trip_id: trip.id, transport_mode: { notIn: ["flight", "train"] } } });
      for (const route of result.routes || []) {
        await prisma.route.create({
          data: {
            trip_id: trip.id,
            from_location: route.from_location || "Unknown",
            to_location: route.to_location || "Unknown",
            transport_mode: route.mode || "driving",
            distance_km: route.distance_km || 0,
            duration_minutes: route.duration_minutes || 0,
            estimated_cost: route.estimated_cost || 0,
            route_data: route,
            created_at: new Date(),
          },
        });
      }
      await createAgentTask(mapsAgent.name, taskData, "SUCCESS", result);
      previousToolResults.push({
        tool: mapsAgent.name,
        status: "SUCCESS",
        resultSummary: result.summary || "Routes calculated",
        result,
      });
      successfulTools++;
      console.log("[Orchestrator] ✅ mapsAgent completed");
    } catch (error) {
      console.warn("[Orchestrator] ⚠️ mapsAgent failed:", error.message);
      await createAgentTask(mapsAgent.name, { tripId: trip.id, mode: "driving" }, "FAILED", null, error);
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
    const [dbItinerary, dbWeather, dbEvents, dbBudgetItems, dbRoutes, dbAgentTasks, tripData] = await Promise.all([
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
      const aiResponse = await model.invoke([
        new SystemMessage("You are a travel assistant. Provide concise, helpful travel planning summaries."),
        new HumanMessage(summaryPrompt),
      ]);
      aiGeneratedInsights = aiResponse.content;
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
      emailSent: emailSent,
      tripSummary: {
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        duration: `${Math.ceil(
          (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
        )} days`,
        travelers: `${trip.adults || 1} adult(s)${trip.children ? `, ${trip.children} child(ren)` : ""}`,
        totalBudget: tripData?.total_budget || collectedData.budget?.result?.budget?.total || 0,
        status: "PLANNING_COMPLETED",
      },
      itinerary: dbItinerary,
      weather: dbWeather,
      events: dbEvents,
      budgetItems: dbBudgetItems,
      routes: dbRoutes,
      agentTasks: dbAgentTasks,
      hotels: tripData.hotels_data,
      news: tripData.news_data,
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
          totalBudget: collectedData.budget?.result?.budget?.total || tripData?.total_budget || 0,
          duration: finalAnswer.tripSummary.duration,
          highlights: dbItinerary.map((i) => i.title).join(", ") || "Trip planned",
          recommendation: aiGeneratedInsights,
        },
      },
    });

    console.log("\n=== Orchestrator Completed Successfully ===");
    console.log(`[Orchestrator] Status: ${finalAnswer.status}`);
    console.log(`[Orchestrator] Success Rate: ${successfulTools}/${totalTools}`);
    console.log(`[Orchestrator] Email Sent: ${emailSent ? 'Yes' : 'No'}`);

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
        errorOccurred: new Date().toISOString(),
      },
    };

    // Update trip with error status
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
        },
      },
    });

    return errorResponse;
  }
}

// --------------------
// Export
// --------------------
export default runMCPOrchestrator;
export { ORCHESTRATOR_SYSTEM_PROMPT };