import express from 'express';
import {
  createTrip,
  getTrips,
  getTripById,
  updateTrip,
  deleteTrip
} from '../controllers/trips.controller.js';
import itineraryRoutes from './itenerary.routes.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createTrip);
router.get('/', getTrips);
router.get('/:id', getTripById);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);

// Nested itinerary routes
router.use('/:tripId/itinerary', itineraryRoutes);

export default router;
