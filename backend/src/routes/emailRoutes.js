// In your routes file (e.g., routes/emailRoutes.js)
import express from 'express';
import { sendTripItineraryEmail } from '../utils/emailUtils.js';
import prisma from '../config/db.js';

const router = express.Router();

// Endpoint to manually send itinerary email
router.post('/trips/:tripId/send-itinerary', async (req, res) => {
  try {
    const { tripId } = req.params;
    const { email } = req.body; // Optional: override email

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { user: true }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const userEmail = email || trip.user?.email;
    if (!userEmail) {
      return res.status(400).json({ error: 'No email address available' });
    }

    const result = await sendTripItineraryEmail(tripId, userEmail);

    res.json({
      success: true,
      message: 'Itinerary email sent successfully',
      email: userEmail,
      tripId: tripId
    });
  } catch (error) {
    console.error('Error sending itinerary email:', error);
    res.status(500).json({ 
      error: 'Failed to send itinerary email',
      details: error.message 
    });
  }
});

export default router;