// src/routes/trip.routes.js
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as tripController from '../controllers/trip.controller.js';
const router = Router();

// ============================================
// TRIP MANAGEMENT
// ============================================
router.post('/trips/start', authenticate, tripController.startTrip);
router.get('/', authenticate, tripController.getAllTrips);
router.get('/:id/summary', authenticate, tripController.getTripSummary);
router.delete('/:id', authenticate, tripController.deleteTrip);

// ============================================
// AGENT-SPECIFIC DATA ROUTES
// ============================================

// Weather Data
router.get('/:id/weather', authenticate, tripController.getWeatherData);

// Flight Data
router.get('/:id/flights', authenticate, tripController.getFlights);

// Hotel Data
router.get('/:id/hotels', authenticate, tripController.getHotels);

//Train Data
router.get('/:id/trains', authenticate, tripController.getTrains);

// News Data
router.get('/:id/news', authenticate, tripController.getNews);

// Budget Data
router.get('/:id/budget', authenticate, tripController.getBudget);
router.get('/:id/budget/items', authenticate, tripController.getBudgetItems);

// Events Data
router.get('/:id/events', authenticate, tripController.getEvents);

// Itinerary Data (both tables)
router.get('/:id/itinerary', authenticate, tripController.getItinerary);
router.get('/:id/itinerary/items', authenticate, tripController.getItineraryItems);
router.get('/:id/itinerary/full', authenticate, tripController.getFullItinerary);

// Routes/Maps Data
router.get('/:id/routes', authenticate, tripController.getRoutes);
router.get('/:id/maps', authenticate, tripController.getMapsData);

// Orchestrator Summary
router.get('/:id/orchestrator', authenticate, tripController.getOrchestratorSummary);

export default router;