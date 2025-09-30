// trips.routes.js
import express from 'express';
import fetch from 'node-fetch';
import { getTripById } from '../controllers/trips.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { PrismaClient } from '@prisma/client'; 

const prisma = new PrismaClient();
const router = express.Router();

router.use(authenticate);

// Trigger MCP for a single trip
router.post('/:id/run-mcp', async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;

  try {
    // Fetch trip from DB
    const trip = await prisma.trip.findFirst({
      where: { id, user_id: userId }
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    const response = await fetch('http://localhost:3000/api/mcp/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('MCP call failed:', text);
      throw new Error(`MCP call failed with status ${response.status}`);
    }

    // Read the response body ONCE and store it
    const messages = await response.json(); 

    // Use the stored data
    res.json({ success: true, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;