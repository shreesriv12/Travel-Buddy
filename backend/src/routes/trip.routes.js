// src/routes/trip.routes.js
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as tripController from '../controllers/trip.controller.js';

const router = Router();

// ============================================
// TRIP MANAGEMENT
// ============================================
router.post('/trips/start', authenticate, tripController.startTrip);
router.get('/trips', authenticate, tripController.getAllTrips);
router.get('/trips/:id/summary', authenticate, tripController.getTripSummary);
router.delete('/trips/:id', authenticate, tripController.deleteTrip);

// ============================================
// AGENT-SPECIFIC DATA ROUTES
// ============================================

// Weather Data
router.get('/trips/:id/weather', authenticate, tripController.getWeatherData);

// Flight Data
router.get('/trips/:id/flights', authenticate, tripController.getFlights);

// Hotel Data
router.get('/trips/:id/hotels', authenticate, tripController.getHotels);

// News Data
router.get('/trips/:id/news', authenticate, tripController.getNews);

// Budget Data
router.get('/trips/:id/budget', authenticate, tripController.getBudget);
router.get('/trips/:id/budget/items', authenticate, tripController.getBudgetItems);

// Events Data
router.get('/trips/:id/events', authenticate, tripController.getEvents);

// Itinerary Data (both tables)
router.get('/trips/:id/itinerary', authenticate, tripController.getItinerary);
router.get('/trips/:id/itinerary/items', authenticate, tripController.getItineraryItems);
router.get('/trips/:id/itinerary/full', authenticate, tripController.getFullItinerary);

// Routes/Maps Data
router.get('/trips/:id/routes', authenticate, tripController.getRoutes);
router.get('/trips/:id/maps', authenticate, tripController.getMapsData);

// Orchestrator Summary
router.get('/trips/:id/orchestrator', authenticate, tripController.getOrchestratorSummary);

export default router;