// src/controllers/trip.controller.js
import prisma from '../config/db.js';

// ============================================
// TRIP MANAGEMENT
// ============================================

/**
 * Start a new trip (no mock data)
 */
export const startTrip = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { prompt } = req.body;

    if (!userId || !prompt) {
      return res.status(400).json({ error: 'Missing userId or prompt.' });
    }

    // This should be handled by the actual tripAgent.js parsing logic
    // Just return a message that the trip is being processed
    res.status(202).json({
      message: 'Trip planning request received. Use the agent endpoint to process.',
      prompt,
    });
  } catch (error) {
    console.error('Error starting trip:', error);
    res.status(500).json({ error: 'Failed to start trip planning.' });
  }
};

/**
 * Get all trips for a user
 */
export const getAllTrips = async (req, res) => {
  try {
    const userId = req.user.userId;

    const trips = await prisma.trip.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: {
            itinerary_items: true,
            events: true,
            budget_items: true,
          }
        }
      }
    });

    res.json({
      totalTrips: trips.length,
      trips,
    });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
};

/**
 * Get comprehensive trip summary
 */
export const getTripSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({
      where: { id, user_id: userId },
      include: {
        weather_data: true,
        budget_items: true,
        itinerary_items: {
          orderBy: [{ day_number: 'asc' }, { sort_order: 'asc' }]
        },
        itinerary: true,
        events: {
          orderBy: { start_datetime: 'asc' }
        },
        routes: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const duration = Math.ceil(
      (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
    );

    const totalBudget = trip.budget_items.reduce(
      (sum, item) => sum + (item.estimated_amount || 0), 0
    );

    const avgTemp = trip.weather_data.length > 0
      ? trip.weather_data.reduce((sum, w) => sum + w.temperature_high, 0) / trip.weather_data.length
      : null;

    const summary = {
      tripDetails: {
        id: trip.id,
        title: trip.title,
        origin: trip.origin,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        duration,
        adults: trip.adults,
        status: trip.status,
      },
      budget: {
        total: Math.round(totalBudget),
        itemsCount: trip.budget_items.length,
      },
      weather: trip.weather_data.length > 0 ? {
        avgTemp: Math.round(avgTemp),
        condition: trip.weather_data[0]?.conditions,
        daysCount: trip.weather_data.length,
      } : null,
      itinerary: {
        daysCount: trip.itinerary_items.length,
        hasFullPlan: !!trip.itinerary,
      },
      events: {
        total: trip.events.length,
        recommended: trip.events.filter(e => e.is_recommended).length,
      },
      routes: {
        count: trip.routes.length,
      },
      hasFlights: !!trip.flights_data,
      hasHotels: !!trip.hotels_data,
      hasNews: !!trip.news_data,
    };

    res.json({ trip, summary });
  } catch (error) {
    console.error('Error fetching trip summary:', error);
    res.status(500).json({ error: 'Failed to fetch trip summary' });
  }
};

/**
 * Delete a trip
 */
export const deleteTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId } 
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    await prisma.trip.delete({ where: { id } });

    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
};

// ============================================
// WEATHER DATA
// ============================================

export const getWeatherData = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId } 
    });
    
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const weatherData = await prisma.weatherData.findMany({
      where: { trip_id: id },
      orderBy: { date: 'asc' },
    });

    if (weatherData.length === 0) {
      return res.status(404).json({ 
        error: 'No weather data found for this trip',
        message: 'Run the weather agent first to fetch weather data'
      });
    }

    const forecast = weatherData.map(w => ({
      date: w.date,
      temp_high: w.temperature_high,
      temp_low: w.temperature_low,
      condition: w.conditions,
      precipitation: w.precipitation,
      weather_json: w.weather_json,
      fetched_at: w.fetched_at,
    }));

    res.json({
      location: trip.destination,
      totalDays: forecast.length,
      forecast,
    });
  } catch (error) {
    console.error('Error fetching weather:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
};





export const getFlights = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    console.log(`[Backend Debug] Received request for flights on trip ID: ${id}`); // Log 1

    const trip = await prisma.trip.findFirst({
      where: { id, user_id: userId },
      select: {
        flights_data: true,
      }
    });

    console.log('[Backend Debug] Trip data fetched:', trip); // Log 2

    if (!trip) {
      console.log('[Backend Debug] Trip not found for user.');
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (!trip.flights_data) {
      console.log('[Backend Debug] No flights_data found. Returning a 200 with no data.');
      return res.status(200).json({
        summary: null,
        bestFlights: [],
        otherFlights: [],
        searchParams: {},
        error: 'No flight data found for this trip'
      });
    }

    console.log('[Backend Debug] Flights data found. Sending response.');
    return res.status(200).json(trip.flights_data);

  } catch (error) {
    console.error('[Backend Debug] Error in getFlights:', error);
    res.status(500).json({ error: 'Failed to fetch flights' });
  }
};



// ============================================
// TRAIN DATA
// ============================================

export const getTrains = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    console.log(`[Backend Debug] Received request for trains on trip ID: ${id}`);

    const trip = await prisma.trip.findFirst({
      where: { id, user_id: userId },
      select: {
        trains_data: true,
        origin: true,
        destination: true,
        start_date: true,
      }
    });

    console.log('[Backend Debug] Trip data fetched:', trip);

    if (!trip) {
      console.log('[Backend Debug] Trip not found for user.');
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (!trip.trains_data) {
      console.log('[Backend Debug] No trains_data found. Returning a 200 with no data.');
      return res.status(200).json({
        summary: null,
        trains: [],
        searchParams: {},
        dataSource: null,
        error: 'No train data found for this trip',
        message: 'Run the train agent first to fetch train data'
      });
    }

    console.log('[Backend Debug] Trains data found. Sending response.');
    
    const trainsData = trip.trains_data;
    
    // Format the response with additional trip context
    const response = {
      summary: trainsData.summary || `Train options from ${trip.origin} to ${trip.destination}`,
      origin: trainsData.searchParams?.origin || trip.origin,
      destination: trainsData.searchParams?.destination || trip.destination,
      departureDate: trainsData.searchParams?.departureDate || trip.start_date,
      totalTrains: trainsData.trains?.length || 0,
      dataSource: trainsData.dataSource || 'Unknown',
      trains: trainsData.trains || [],
      searchParams: trainsData.searchParams || {},
      fallback: trainsData.fallback || false,
      error: trainsData.error || null
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('[Backend Debug] Error in getTrains:', error);
    res.status(500).json({ error: 'Failed to fetch trains' });
  }
};


// ============================================
// HOTEL DATA
// ============================================

export const getHotels = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId },
      select: {
        hotels_data: true,
        destination: true,
        start_date: true,
        end_date: true,
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (!trip.hotels_data) {
      return res.status(404).json({ 
        error: 'No hotel data found for this trip',
        message: 'Run the hotels agent first to fetch hotel data'
      });
    }

    const hotelData = trip.hotels_data;

    res.json({
      summary: hotelData.summary || `Hotel options in ${trip.destination}`,
      destination: hotelData.destination || trip.destination,
      checkin: hotelData.checkin || trip.start_date,
      checkout: hotelData.checkout || trip.end_date,
      totalHotels: hotelData.totalHotels || hotelData.hotels?.length || 0,
      priceStatistics: hotelData.priceStatistics || {},
      hotels: hotelData.hotels || [],
      searchParams: hotelData.searchParams || {},
    });
  } catch (error) {
    console.error('Error fetching hotels:', error);
    res.status(500).json({ error: 'Failed to fetch hotels' });
  }
};


// ============================================
// NEWS DATA
// ============================================

export const getNews = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId },
      select: {
        news_data: true,
        destination: true,
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (!trip.news_data) {
      return res.status(404).json({ 
        error: 'No news data found for this trip',
        message: 'Run the news agent first to fetch news data'
      });
    }

    const newsData = trip.news_data;

    res.json({
      summary: newsData.summary || `Latest news about ${trip.destination}`,
      destination: newsData.destination || trip.destination,
      totalArticles: newsData.totalArticles || newsData.articles?.length || 0,
      timeRange: newsData.timeRange || {},
      articles: newsData.articles || [],
      searchQuery: newsData.searchQuery || trip.destination,
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
};

// ============================================
// BUDGET DATA
// ============================================

export const getBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId },
      select: {
        total_budget: true,
        title: true,
        destination: true,
        start_date: true,
        end_date: true,
        adults: true,
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const budgetItems = await prisma.budgetItem.findMany({
      where: { trip_id: id },
      orderBy: { category: 'asc' }
    });

    if (budgetItems.length === 0) {
      return res.status(404).json({ 
        error: 'No budget data found for this trip',
        message: 'Run the budget agent first to calculate budget'
      });
    }

    const totalEstimated = budgetItems.reduce((sum, item) => sum + item.estimated_amount, 0);
    const totalActual = budgetItems.reduce((sum, item) => sum + item.actual_amount, 0);

    const categoryBreakdown = budgetItems.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = {
          estimated: 0,
          actual: 0,
          items: []
        };
      }
      acc[item.category].estimated += item.estimated_amount;
      acc[item.category].actual += item.actual_amount;
      acc[item.category].items.push(item);
      return acc;
    }, {});

    const duration = Math.ceil(
      (new Date(trip.end_date) - new Date(trip.start_date)) / (1000 * 60 * 60 * 24)
    );

    res.json({
      summary: `Budget breakdown for ${trip.title}`,
      budget: {
        total: totalEstimated,
        totalActual: totalActual,
        perPerson: totalEstimated / trip.adults,
        perDay: totalEstimated / duration,
        categoryBreakdown
      },
      recommendations: budgetItems
        .filter(item => item.notes)
        .map(item => item.notes),
      tripInfo: {
        destination: trip.destination,
        duration,
        travelers: trip.adults,
        dates: {
          start: trip.start_date,
          end: trip.end_date
        }
      }
    });
  } catch (error) {
    console.error('Error fetching budget:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
};

export const getBudgetItems = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId } 
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const budgetItems = await prisma.budgetItem.findMany({ 
      where: { trip_id: id },
      orderBy: { category: 'asc' }
    });

    if (budgetItems.length === 0) {
      return res.status(404).json({ 
        error: 'No budget items found for this trip',
        message: 'Run the budget agent first to create budget items'
      });
    }

    const totalEstimated = budgetItems.reduce((sum, item) => sum + item.estimated_amount, 0);
    const totalActual = budgetItems.reduce((sum, item) => sum + item.actual_amount, 0);

    res.json({ 
      tripId: id, 
      budgetItems,
      totals: {
        estimated: totalEstimated,
        actual: totalActual,
        difference: totalEstimated - totalActual
      }
    });
  } catch (error) {
    console.error('Error fetching budget items:', error);
    res.status(500).json({ error: 'Failed to fetch budget items' });
  }
};

// ============================================
// EVENTS DATA
// ============================================

export const getEvents = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId } 
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const events = await prisma.event.findMany({
      where: { trip_id: id },
      orderBy: { start_datetime: 'asc' },
    });

    if (events.length === 0) {
      return res.status(404).json({ 
        error: 'No events found for this trip',
        message: 'Run the events agent first to fetch events'
      });
    }

    res.json({ 
      tripId: id, 
      totalEvents: events.length,
      recommendedCount: events.filter(e => e.is_recommended).length,
      events 
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

// ============================================
// ITINERARY DATA (Both Tables)
// ============================================

export const getItinerary = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId } 
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const itinerary = await prisma.itinerary.findUnique({
      where: { trip_id: id }
    });

    if (!itinerary) {
      return res.status(404).json({ 
        error: 'No itinerary found for this trip',
        message: 'Run the itinerary agent first to generate an itinerary'
      });
    }

    res.json({ 
      tripId: id,
      tool: itinerary.tool,
      resultSummary: itinerary.result_summary,
      fullPlan: itinerary.full_plan,
      createdAt: itinerary.created_at,
      updatedAt: itinerary.updated_at
    });
  } catch (error) {
    console.error('Error fetching itinerary:', error);
    res.status(500).json({ error: 'Failed to fetch itinerary' });
  }
};

export const getItineraryItems = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId } 
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const itineraryItems = await prisma.itineraryItem.findMany({
      where: { trip_id: id },
      orderBy: [
        { day_number: 'asc' },
        { sort_order: 'asc' }
      ]
    });

    if (itineraryItems.length === 0) {
      return res.status(404).json({ 
        error: 'No itinerary items found for this trip',
        message: 'Run the itinerary agent first to generate itinerary items'
      });
    }

    const groupedByDay = itineraryItems.reduce((acc, item) => {
      if (!acc[item.day_number]) {
        acc[item.day_number] = [];
      }
      acc[item.day_number].push(item);
      return acc;
    }, {});

    res.json({ 
      tripId: id,
      totalItems: itineraryItems.length,
      totalDays: Object.keys(groupedByDay).length,
      itemsByDay: groupedByDay,
      allItems: itineraryItems
    });
  } catch (error) {
    console.error('Error fetching itinerary items:', error);
    res.status(500).json({ error: 'Failed to fetch itinerary items' });
  }
};

export const getFullItinerary = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId } 
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const [itinerary, itineraryItems] = await Promise.all([
      prisma.itinerary.findUnique({ where: { trip_id: id } }),
      prisma.itineraryItem.findMany({
        where: { trip_id: id },
        orderBy: [{ day_number: 'asc' }, { sort_order: 'asc' }]
      })
    ]);

    if (!itinerary && itineraryItems.length === 0) {
      return res.status(404).json({ 
        error: 'No itinerary data found for this trip',
        message: 'Run the itinerary agent first to generate an itinerary'
      });
    }

    const groupedByDay = itineraryItems.reduce((acc, item) => {
      if (!acc[item.day_number]) {
        acc[item.day_number] = [];
      }
      acc[item.day_number].push(item);
      return acc;
    }, {});

    res.json({
      tripId: id,
      mainItinerary: itinerary ? {
        tool: itinerary.tool,
        resultSummary: itinerary.result_summary,
        fullPlan: itinerary.full_plan,
        createdAt: itinerary.created_at,
        updatedAt: itinerary.updated_at
      } : null,
      detailedItems: {
        totalItems: itineraryItems.length,
        totalDays: Object.keys(groupedByDay).length,
        itemsByDay: groupedByDay,
        allItems: itineraryItems
      }
    });
  } catch (error) {
    console.error('Error fetching full itinerary:', error);
    res.status(500).json({ error: 'Failed to fetch full itinerary' });
  }
};

// ============================================
// ROUTES/MAPS DATA
// ============================================

export const getRoutes = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId } 
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const routes = await prisma.route.findMany({ 
      where: { trip_id: id },
      orderBy: { created_at: 'asc' }
    });

    if (routes.length === 0) {
      return res.status(404).json({ 
        error: 'No routes found for this trip',
        message: 'Run the maps agent first to calculate routes'
      });
    }

    res.json({
      tripId: id,
      totalRoutes: routes.length,
      routes: routes.map(r => ({
        id: r.id,
        fromLocation: r.from_location,
        toLocation: r.to_location,
        transportMode: r.transport_mode,
        distanceKm: r.distance_km,
        durationMinutes: r.duration_minutes,
        estimatedCost: r.estimated_cost,
        routeData: r.route_data,
        fullResponse: r.full_response,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
};

export const getMapsData = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId },
      select: {
        origin: true,
        origin_coords: true,
        destination: true,
        destination_coords: true,
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const routes = await prisma.route.findMany({ 
      where: { trip_id: id },
      orderBy: { created_at: 'asc' }
    });

    res.json({
      tripId: id,
      mapsData: {
        origin: trip.origin,
        originCoords: trip.origin_coords,
        destination: trip.destination,
        destinationCoords: trip.destination_coords,
        routes: routes.map(r => ({
          from: r.from_location,
          to: r.to_location,
          mode: r.transport_mode,
          distance: r.distance_km,
          duration: r.duration_minutes,
          cost: r.estimated_cost,
          data: r.route_data
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching maps data:', error);
    res.status(500).json({ error: 'Failed to fetch maps data' });
  }
};

// ============================================
// ORCHESTRATOR SUMMARY (Keep for backward compatibility)
// ============================================

export const getOrchestratorSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({ 
      where: { id, user_id: userId },
      select: {
        orchestrator_summary: true,
      }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (!trip.orchestrator_summary) {
      return res.status(404).json({ 
        error: 'No orchestrator summary found for this trip',
        message: 'This field is for backward compatibility. Data is now stored in dedicated fields.'
      });
    }

    res.json({
      tripId: id,
      orchestratorSummary: trip.orchestrator_summary
    });
  } catch (error) {
    console.error('Error fetching orchestrator summary:', error);
    res.status(500).json({ error: 'Failed to fetch orchestrator summary' });
  }
};