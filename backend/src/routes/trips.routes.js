import express from 'express';
import fetch from 'node-fetch';
import { authenticate } from '../middleware/auth.middleware.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

router.use(authenticate);

// CREATE a new trip
router.post('/', async (req, res) => {
  const userId = req.user.userId;
  const {
    title,
    origin,
    origin_coords,
    destination,
    destination_coords,
    start_date,
    end_date,
    adults,
    status,
    total_budget,
    summary
  } = req.body;

  try {
    if (!title || !destination || !start_date || !end_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const trip = await prisma.trip.create({
      data: {
        user_id: userId,
        title,
        origin: origin || 'Unknown',
        origin_coords: origin_coords || {},
        destination,
        destination_coords,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        adults: adults || 1,
        status: status || 'planned',
        total_budget: total_budget || 0,
        summary: summary || {}
      }
    });

    res.status(201).json({ success: true, trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Trigger MCP for a single trip
router.post('/:id/run-mcp', async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;

  try {
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

    const messages = await response.json();
    res.json({ success: true, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
