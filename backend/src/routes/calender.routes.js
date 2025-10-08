// src/routes/calendar.routes.js
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import * as calendarController from '../controllers/calender.controller.js';
const router = Router();

// Sync itinerary to Google Calendar
router.post('/sync', authenticate, calendarController.syncToGoogleCalendar);

// Get Google OAuth URL (for initial authentication)
router.get('/auth-url', calendarController.getGoogleAuthUrl);

// Handle Google OAuth callback
router.get('/callback', calendarController.handleGoogleCallback);

export default router;