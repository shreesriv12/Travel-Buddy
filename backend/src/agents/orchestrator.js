// orchestrator.js
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
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
// Tool Registry
// --------------------
const TOOL_REGISTRY = {
  [weatherAgent.name]: weatherAgent,
  [budgetAgent.name]: budgetAgent,
  [eventsAgent.name]: eventsAgent,
  [itineraryAgent.name]: itineraryAgent,
  [mapsAgent.name]: mapsAgent,
  [flightAgent.name]: flightAgent,
  [newsAgent.name]: newsAgent,
  [hotelsAgent.name]: hotelsAgent,
};

// --------------------
// Database Storage Functions
// --------------------

async function storeFlightData(tripId, flightResult) {
  try {
    await prisma.trip.update({
      where: { id: tripId },
      data: { flights_data: flightResult }
    });
    console.log(`[DB] Flight data stored for trip ${tripId}`);
  } catch (error) {
    console.error(`[DB] Error storing flight data:`, error.message);
  }
}

async function storeHotelData(tripId, hotelResult) {
  try {
    await prisma.trip.update({
      where: { id: tripId },
      data: { hotels_data: hotelResult }
    });
    console.log(`[DB] Hotel data stored for trip ${tripId}`);
  } catch (error) {
    console.error(`[DB] Error storing hotel data:`, error.message);
  }
}

async function storeNewsData(tripId, newsResult) {
  try {
    await prisma.trip.update({
      where: { id: tripId },
      data: { news_data: newsResult }
    });
    console.log(`[DB] News data stored for trip ${tripId}`);
  } catch (error) {
    console.error(`[DB] Error storing news data:`, error.message);
  }
}

async function storeWeatherData(tripId, weatherResult) {
  try {
    await prisma.weatherData.deleteMany({ where: { trip_id: tripId } });

    if (weatherResult.forecast && Array.isArray(weatherResult.forecast)) {
      for (const day of weatherResult.forecast) {
        await prisma.weatherData.create({
          data: {
            trip_id: tripId,
            location: weatherResult.location || 'Unknown',
            date: new Date(day.date),
            temperature_high: day.maxTemp || 0,
            temperature_low: day.minTemp || 0,
            conditions: day.condition || 'Unknown',
            precipitation: day.precipitation || 0,
            weather_json: day
          }
        });
      }
      console.log(`[DB] Weather data stored for trip ${tripId}`);
    }
  } catch (error) {
    console.error(`[DB] Error storing weather data:`, error.message);
  }
}

async function storeEventsData(tripId, eventsResult) {
  try {
    await prisma.event.deleteMany({ where: { trip_id: tripId } });

    if (eventsResult.events && Array.isArray(eventsResult.events)) {
      for (const event of eventsResult.events) {
        await prisma.event.create({
          data: {
            trip_id: tripId,
            title: event.name || 'Unknown Event',
            description: event.description || 'No description available',
            location: event.location || 'Unknown Location',
            start_datetime: new Date(event.date || new Date()),
            end_datetime: new Date(event.endDate || new Date()),
            category: event.category || 'General',
            price: event.price || 0,
            booking_url: event.bookingLink || null,
            is_recommended: event.recommended || false,
            relevance_score: event.relevanceScore || 0
          }
        });
      }
      console.log(`[DB] Events data stored for trip ${tripId}`);
    }
  } catch (error) {
    console.error(`[DB] Error storing events data:`, error.message);
  }
}

async function storeItineraryData(tripId, itineraryResult) {
  try {
    await prisma.itineraryItem.deleteMany({ where: { trip_id: tripId } });

    if (itineraryResult.itinerary && Array.isArray(itineraryResult.itinerary)) {
      let sortOrder = 0;
      for (const day of itineraryResult.itinerary) {
        if (day.activities && Array.isArray(day.activities)) {
          for (const activity of day.activities) {
            await prisma.itineraryItem.create({
              data: {
                trip_id: tripId,
                day_number: day.day || 1,
                title: activity.title || 'Unknown Activity',
                description: activity.description || 'No description',
                start_time: new Date(activity.startTime || new Date()),
                end_time: new Date(activity.endTime || new Date()),
                location: activity.location || 'Unknown',
                location_coords: activity.coordinates || {},
                category: activity.category || 'General',
                estimated_cost: activity.cost || 0,
                sort_order: sortOrder++
              }
            });
          }
        }
      }
      console.log(`[DB] Itinerary data stored for trip ${tripId}`);
    }
  } catch (error) {
    console.error(`[DB] Error storing itinerary data:`, error.message);
  }
}

// --------------------
// Data Processing Functions for Detailed Response
// --------------------

function processFlightData(flightData) {
  if (!flightData) return null;
  
  return {
    summary: flightData.summary,
    bestFlights: flightData.bestFlights?.map(flight => ({
      airline: flight.airline,
      flightNumbers: flight.flightNumbers,
      departureTime: flight.departureTime,
      arrivalTime: flight.arrivalTime,
      duration: flight.duration,
      stops: flight.stops,
      price: flight.price,
      currency: flight.currency,
      bookingLink: flight.bookingLink,
      segments: flight.flightSegments
    })) || [],
    otherFlights: flightData.otherFlights?.length || 0,
    searchParams: flightData.searchParams
  };
}

function processHotelData(hotelData) {
  if (!hotelData) return null;
  
  return {
    summary: hotelData.summary,
    hotels: hotelData.hotels?.map(hotel => ({
      name: hotel.name,
      rating: hotel.rating,
      reviewCount: hotel.reviewCount,
      pricePerNight: hotel.price,
      totalPrice: hotel.totalPrice,
      currency: hotel.currency,
      address: hotel.address,
      amenities: hotel.amenities,
      description: hotel.description,
      bookingLink: hotel.bookingLink
    })) || [],
    priceStatistics: hotelData.priceStatistics,
    totalHotels: hotelData.totalHotels,
    searchParams: hotelData.searchParams
  };
}

function processNewsData(newsData) {
  if (!newsData) return null;
  
  return {
    summary: newsData.summary,
    articles: newsData.articles?.map(article => ({
      title: article.title,
      snippet: article.snippet,
      source: article.source,
      date: article.date,
      link: article.link,
      thumbnail: article.thumbnail
    })) || [],
    totalArticles: newsData.totalArticles,
    timeRange: newsData.timeRange
  };
}

function processWeatherData(weatherData) {
  if (!weatherData || !Array.isArray(weatherData)) return null;
  
  return {
    forecast: weatherData.map(day => ({
      date: day.date,
      conditions: day.conditions,
      temperatureHigh: day.temperature_high,
      temperatureLow: day.temperature_low,
      precipitation: day.precipitation
    })),
    totalDays: weatherData.length
  };
}

function processEventsData(eventsData) {
  if (!eventsData || !Array.isArray(eventsData)) return null;
  
  return {
    events: eventsData.map(event => ({
      title: event.title,
      description: event.description,
      location: event.location,
      startDateTime: event.start_datetime,
      endDateTime: event.end_datetime,
      category: event.category,
      price: event.price,
      bookingUrl: event.booking_url,
      isRecommended: event.is_recommended
    })),
    totalEvents: eventsData.length
  };
}

function processItineraryData(itineraryData) {
  if (!itineraryData || !Array.isArray(itineraryData)) return null;
  
  const days = {};
  itineraryData.forEach(item => {
    if (!days[item.day_number]) {
      days[item.day_number] = [];
    }
    days[item.day_number].push({
      title: item.title,
      description: item.description,
      startTime: item.start_time,
      endTime: item.end_time,
      location: item.location,
      category: item.category,
      estimatedCost: item.estimated_cost
    });
  });

  return {
    days: Object.keys(days).map(dayNumber => ({
      day: parseInt(dayNumber),
      activities: days[dayNumber]
    })),
    totalActivities: itineraryData.length,
    totalDays: Object.keys(days).length
  };
}

function processBudgetData(budgetResult) {
  if (!budgetResult) return null;
  
  return {
    summary: budgetResult.summary,
    budget: budgetResult.budget,
    breakdown: budgetResult.breakdown,
    recommendations: budgetResult.recommendations
  };
}

// --------------------
// Main Orchestrator - Returns Detailed Response
// --------------------
export async function runMCPOrchestrator(trip, { maxSteps = 10 } = {}) {
  console.log("\n=== MCP Orchestrator Started ===");
  console.log(`[Orchestrator] Trip ID: ${trip.id}, Destination: ${trip.destination}`);

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
        adults: trip.adults || 1
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
        adults: trip.adults || 2,
        rooms: 1,
        currency: "USD",
        sortBy: "relevance"
      });

      await storeHotelData(trip.id, result);
      collectedData.hotels = result;
      
      previousToolResults.push({
        tool: hotelsAgent.name,
        status: 'SUCCESS',
        resultSummary: result.summary || "Hotels found and stored",
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

      await storeNewsData(trip.id, result);
      collectedData.news = result;
      
      previousToolResults.push({
        tool: newsAgent.name,
        status: 'SUCCESS',
        resultSummary: result.summary || "News articles fetched and stored",
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
      const flightData = collectedData.flights;
      const hotelData = collectedData.hotels;

      const result = await budgetAgent.execute({
        tripId: trip.id,
        adults: trip.adults || 1,
        flightData: flightData,
        hotelData: hotelData
      });

      collectedData.budget = result;
      
      previousToolResults.push({
        tool: budgetAgent.name,
        status: 'SUCCESS',
        resultSummary: result.summary || "Budget calculated",
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
        budgetResult: collectedData.budget,
        eventsResult: collectedData.events,
        hotelResult: collectedData.hotels
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
    console.log("[Orchestrator] Executing mapsAgent for routes...");
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
    // FINAL: Generate Comprehensive Detailed Response
    // ============================================
    console.log("\n[Orchestrator] All agents completed. Generating detailed response...");

    // Fetch all data from database for complete response
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
          news_data: true 
        }
      })
    ]);

    // Process all data for detailed response
    const detailedResponse = {
      // Trip Basic Information
      tripInfo: {
        id: trip.id,
        title: trip.title,
        origin: trip.origin,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        duration: `${Math.ceil((new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24))} days`,
        travelers: `${trip.adults || 1} adult(s)`,
        status: 'PLANNING_COMPLETED'
      },

      // Comprehensive Travel Data
      travelData: {
        // Flight Information
        flights: processFlightData(tripData?.flights_data),
        
        // Hotel Information
        hotels: processHotelData(tripData?.hotels_data),
        
        // Destination News
        news: processNewsData(tripData?.news_data),
        
        // Weather Forecast
        weather: processWeatherData(dbWeather),
        
        // Local Events
        events: processEventsData(dbEvents),
        
        // Travel Itinerary
        itinerary: processItineraryData(dbItinerary),
        
        // Budget Information
        budget: processBudgetData(collectedData.budget)
      },

      // Trip Summary & Recommendations
      summary: {
        totalCostEstimate: collectedData.budget?.budget?.total || 0,
        bestFlightOption: tripData?.flights_data?.bestFlights?.[0] ? {
          airline: tripData.flights_data.bestFlights[0].airline,
          price: tripData.flights_data.bestFlights[0].price,
          duration: tripData.flights_data.bestFlights[0].duration
        } : null,
        recommendedHotels: tripData?.hotels_data?.hotels?.slice(0, 3).map(hotel => ({
          name: hotel.name,
          rating: hotel.rating,
          price: hotel.price
        })) || [],
        weatherAdvice: dbWeather.length > 0 ? `Pack for ${dbWeather[0]?.conditions} weather` : 'Check weather updates',
        keyAttractions: dbEvents.slice(0, 5).map(event => event.title)
      },

      // Agent Execution Report
      executionReport: {
        totalAgents: previousToolResults.length,
        successfulAgents: previousToolResults.filter(r => r.status === 'SUCCESS').length,
        failedAgents: previousToolResults.filter(r => r.status === 'FAILED').length,
        agentDetails: previousToolResults.map(agent => ({
          name: agent.tool,
          status: agent.status,
          summary: agent.resultSummary,
          timestamp: new Date().toISOString()
        }))
      },

      // Data Storage Status
      dataStatus: {
        flightsStored: !!tripData?.flights_data,
        hotelsStored: !!tripData?.hotels_data,
        newsStored: !!tripData?.news_data,
        weatherStored: dbWeather.length > 0,
        eventsStored: dbEvents.length > 0,
        itineraryStored: dbItinerary.length > 0,
        databaseId: trip.id
      },

      // Timestamps
      timestamps: {
        planningStarted: new Date().toISOString(),
        planningCompleted: new Date().toISOString(),
        dataLastUpdated: new Date().toISOString()
      }
    };

    // Update trip status in database
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: 'COMPLETED',
        summary: {
          totalCost: detailedResponse.summary.totalCostEstimate,
          duration: detailedResponse.tripInfo.duration,
          highlights: detailedResponse.summary.keyAttractions,
          recommendation: 'Trip planning completed successfully'
        }
      }
    });

    console.log("\n=== Orchestrator Completed Successfully ===");
    console.log(`[Orchestrator] Generated detailed response with:`);
    console.log(`  - ${detailedResponse.travelData.flights?.bestFlights?.length || 0} flight options`);
    console.log(`  - ${detailedResponse.travelData.hotels?.hotels?.length || 0} hotel options`);
    console.log(`  - ${detailedResponse.travelData.news?.articles?.length || 0} news articles`);
    console.log(`  - ${detailedResponse.travelData.weather?.totalDays || 0} weather forecasts`);
    console.log(`  - ${detailedResponse.travelData.events?.totalEvents || 0} local events`);
    console.log(`  - ${detailedResponse.travelData.itinerary?.totalActivities || 0} itinerary activities`);
    
    return detailedResponse;

  } catch (error) {
    console.error("[Orchestrator] Critical error:", error.message);
    
    // Update trip status to failed
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        status: 'FAILED',
        summary: { error: error.message }
      }
    });
    
    // Return error response with partial data
    return {
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
  }
}

export default runMCPOrchestrator;