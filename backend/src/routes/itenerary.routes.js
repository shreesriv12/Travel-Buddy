import express from 'express';
import {
  createItineraryItem,
  getItineraryItems,
  updateItineraryItem,
  deleteItineraryItem
} from '../controllers/itenerary.controleer.js';
import { authenticate } from '../middleware/auth.middleware.js';
const router = express.Router({ mergeParams: true }); // mergeParams allows access to tripId

router.use(authenticate);

router.post('/', createItineraryItem);
router.get('/', getItineraryItems);
router.put('/:itemId', updateItineraryItem);
router.delete('/:itemId', deleteItineraryItem);

export default router;
