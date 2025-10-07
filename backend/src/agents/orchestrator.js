import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { weatherAgent } from "./weatherAgent.js";
import { budgetAgent } from "./budgetAgent.js";
import { eventsAgent } from "./eventsAgent.js";
import { itineraryAgent } from "./itineraryAgent.js";
import { mapsAgent } from "./mapsAgent.js";
import { flightAgent } from "./flightAgent.js";
import { hotelsAgent } from "./hotelsAgent.js";
import { newsAgent } from "./newsAgent.js";
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
   - This must complete before proceeding

2. **flightAgent** (REQUIRED)
   - Searches for available flights
   - Required inputs: origin, destination, departureDate, returnDate, adults, tripId
   - Essential for trip planning and budget calculation

3. **trainAgent** (OPTIONAL - runs after flights)
   - Searches for train options as alternative transport
   - Required inputs: origin, destination, departureDate, tripId, adults
   - Provides transport alternatives

4. **hotelsAgent** (REQUIRED)
   - Searches for hotel accommodations
   - Required inputs: destination, checkin, checkout, adults, children, rooms, tripId
   - Critical for accommodation planning and budgeting

5. **newsAgent** (REQUIRED)
   - Fetches recent news about the destination
   - Required inputs: destination, tripId, maxResults, timeRange
   - Provides important safety and event information

6. **budgetAgent** (REQUIRED)
   - Calculates trip budget based on flights, hotels, and activities
   - Required inputs: tripId, adults
   - Must run AFTER flights and hotels are fetched

7. **eventsAgent** (REQUIRED)
   - Finds local events and activities at the destination
   - Required inputs: tripId, destination, date
   - Must run AFTER budget to align with spending capacity

8. **itineraryAgent** (REQUIRED)
   - Generates day-by-day itinerary with activities and POIs
   - Required inputs: tripId, destination, days, startDate, adults, children, budgetResult
   - Must run AFTER weather, budget, and events are available
   - AUTOMATICALLY SENDS EMAIL with itinerary

9. **mapsAgent** (REQUIRED - ALWAYS LAST)
   - Calculates routes between points of interest
   - Required inputs: tripId, mode (driving/walking/transit)
   - Must run AFTER itinerary to calculate routes between generated POIs

## EXECUTION RULES
- **SEQUENTIAL EXECUTION**: Tools must be called in the order listed above
- **NO SKIPPING**: Every tool must be attempted, even if previous tools fail
- **DEPENDENCY AWARENESS**: Some tools require outputs from previous tools
- **ERROR HANDLING**: If a tool fails, log the error but continue with remaining tools
- **COMPLETION**: Only declare success when ALL tools have been executed

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
✓ All tools were attempted
✓ Results stored in previousToolResults array
✓ Database updated with itinerary items
✓ Final summary generated with all tool results
✓ Trip.orchestrator_summary field updated in database

Remember: Your success is measured by attempting ALL tools and providing complete trip planning data, not by achieving 100% tool success rate. Partial data is better than no data.`;

// --------------------
// Helper: Get Dynamic System Prompt with Trip Context
// --------------------
function getOrchestratorPrompt(trip) {
  return `${ORCHESTRATOR_SYSTEM_PROMPT}

## CURRENT TRIP CONTEXT
- Trip ID: ${trip.id}
- Destination: ${trip.destination}
- Origin: ${trip.origin || 'Not specified'}
- Start Date: ${trip.start_date?.toISOString().split('T')[0]}
- End Date: ${trip.end_date?.toISOString().split('T')[0]}
- Adults: ${trip.adults || 1}
- Children: ${trip.children || 0}
- Duration: ${Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24))} days

Begin executing all tools now. Report progress after each tool completion.`;
}

// --------------------
// Main Orchestrator - Simplified Sequential Execution
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

  try {
    // Log the system prompt being used
    console.log("[Orchestrator] System Prompt Loaded:");
    console.log(getOrchestratorPrompt(trip).substring(0, 200) + "...\n");

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
        adults: trip.adults || 1,
        tripId: trip.id
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
    // 3️⃣ TRAIN AGENT (Optional - after flights)
    // ============================================
    console.log("[Orchestrator] Executing trainAgent...");
    try {
      const result = await trainAgent.execute({
        origin: trip.origin,
        destination: trip.destination,
        departureDate: trip.start_date?.toISOString().split('T')[0],
        tripId: trip.id,
        adults: trip.adults || 1
      });

      previousToolResults.push({
        tool: trainAgent.name,
        resultSummary: result.summary || "Trains found",
        result
      });
      console.log("[Orchestrator] ✅ trainAgent completed");
    } catch (error) {
      console.warn("[Orchestrator] ⚠️ trainAgent failed:", error.message);
      previousToolResults.push({
        tool: trainAgent.name,
        resultSummary: "Train search failed",
        error: error.message
      });
    }

    // ============================================
    // 4️⃣ HOTELS AGENT (After flights)
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

      previousToolResults.push({
        tool: hotelsAgent.name,
        resultSummary: result.summary || "Hotels fetched",
        result
      });
      console.log("[Orchestrator] ✅ hotelsAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ hotelsAgent failed:", error.message);
      previousToolResults.push({
        tool: hotelsAgent.name,
        resultSummary: "Hotel search failed",
        error: error.message
      });
    }

    // ============================================
    // 5️⃣ NEWS AGENT (After hotels)
    // ============================================
    console.log("[Orchestrator] Executing newsAgent...");
    try {
      const result = await newsAgent.execute({
        destination: trip.destination,
        tripId: trip.id,
        maxResults: 10,
        timeRange: '1m'
      });

      previousToolResults.push({
        tool: newsAgent.name,
        resultSummary: result.summary || "News fetched",
        result
      });
      console.log("[Orchestrator] ✅ newsAgent completed");
    } catch (error) {
      console.error("[Orchestrator] ❌ newsAgent failed:", error.message);
      previousToolResults.push({
        tool: newsAgent.name,
        resultSummary: "News fetch failed",
        error: error.message
      });
    }

    // ============================================
    // 6️⃣ BUDGET AGENT (After flights & hotels)
    // ============================================
    console.log("[Orchestrator] Executing budgetAgent...");
    try {
      const result = await budgetAgent.execute({
        tripId: trip.id,
        adults: trip.adults || 1
      });

      previousToolResults.push({
        tool: budgetAgent.name,
        resultSummary: result.resultSummary || "Budget calculated",
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
    // 7️⃣ EVENTS AGENT (After budget)
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
      console.warn("[Orchestrator] ⚠️ eventsAgent failed:", error.message);
      previousToolResults.push({
        tool: eventsAgent.name,
        resultSummary: "Events fetch failed",
        error: error.message
      });
    }

    // ============================================
    // 8️⃣ ITINERARY AGENT (After weather + budget + events)
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
        result,
        emailSent: result.emailSent || false
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
    // 9️⃣ MAPS AGENT (After itinerary - routes between POIs)
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
      console.warn("[Orchestrator] ⚠️ mapsAgent failed:", error.message);
      previousToolResults.push({
        tool: mapsAgent.name,
        resultSummary: "Route calculation failed",
        error: error.message
      });
    }

    // ============================================
    // FINAL: Generate AI-Enhanced Summary
    // ============================================
    console.log("\n[Orchestrator] All agents completed. Generating AI-enhanced summary...");

    // Prepare context for AI summary
    const summaryContext = previousToolResults.map(r => ({
      tool: r.tool,
      status: r.error ? 'failed' : 'success',
      summary: r.resultSummary,
      emailSent: r.emailSent
    }));

    // Generate AI summary using the model
    let aiGeneratedInsights = "";
    try {
      const summaryPrompt = `Based on the following tool execution results, provide a brief, friendly summary for the traveler:

${JSON.stringify(summaryContext, null, 2)}

Trip Details:
- Destination: ${trip.destination}
- Duration: ${Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24))} days
- Travelers: ${trip.adults || 1} adult(s)

Provide a 2-3 sentence summary highlighting the key planning achievements and any important notes.`;

      const aiResponse = await model.invoke([
        new SystemMessage(ORCHESTRATOR_SYSTEM_PROMPT),
        new HumanMessage(summaryPrompt)
      ]);

      aiGeneratedInsights = aiResponse.content;
      console.log("[Orchestrator] AI Summary Generated:", aiGeneratedInsights);
    } catch (error) {
      console.warn("[Orchestrator] AI summary generation failed:", error.message);
      aiGeneratedInsights = "Trip planning completed successfully with all available data.";
    }

    // Fetch complete itinerary from DB
    const itineraryItems = await prisma.itineraryItem.findMany({
      where: { trip_id: trip.id },
      orderBy: [{ day_number: "asc" }, { sort_order: "asc" }]
    });

    const successfulTools = previousToolResults.filter(r => !r.error).length;
    const totalTools = previousToolResults.length;

    // Check if email was sent
    const itineraryResult = previousToolResults.find(r => r.tool === itineraryAgent.name);
    const emailSent = itineraryResult?.emailSent || false;

    const finalAnswer = {
      status: successfulTools === totalTools ? "COMPLETE_SUCCESS" : "PARTIAL_SUCCESS",
      message: `Trip planning completed with ${successfulTools}/${totalTools} tools successful`,
      aiInsights: aiGeneratedInsights,
      emailSent: emailSent,
      tripSummary: {
        destination: trip.destination,
        duration: `${Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24))} days`,
        travelers: `${trip.adults || 1} adult(s)`,
        budget: previousToolResults.find(r => r.tool === budgetAgent.name)?.result?.budget || {}
      },
      itinerary: itineraryItems,
      toolResults: previousToolResults,
      executionMetadata: {
        totalTools,
        successfulTools,
        failedTools: totalTools - successfulTools,
        executionTime: new Date().toISOString()
      }
    };

    console.log("\n=== Orchestrator Completed Successfully ===");
    console.log(`[Orchestrator] Status: ${finalAnswer.status}`);
    console.log(`[Orchestrator] Success Rate: ${successfulTools}/${totalTools}`);
    console.log(`[Orchestrator] Email Sent: ${emailSent ? 'Yes' : 'No'}`);

    // Store the full orchestrator JSON in Trip.orchestrator_summary
    await prisma.trip.update({
      where: { id: trip.id },
      data: { orchestrator_summary: finalAnswer }
    });

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

// --------------------
// Export
// --------------------
export default runMCPOrchestrator;
export { ORCHESTRATOR_SYSTEM_PROMPT, getOrchestratorPrompt };