
// ============================================
// BACKEND: API Route (routes/itinerary.js)
// ============================================
import express from 'express';
import prisma from '../config/db.js';
import { generatePdfBuffer } from '../agents/itineraryAgent.js';

const router = express.Router();

router.get('/download-pdf/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;

    // Fetch trip and itinerary
    const trip = await prisma.trip.findUnique({ 
      where: { id: tripId },
      include: { user: true }
    });

    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Get itinerary plan
    const itinerary = await prisma.itinerary.findFirst({
      where: { trip_id: tripId },
      orderBy: { created_at: 'desc' }
    });

    if (!itinerary || !itinerary.full_plan) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    // Generate PDF
    const pdfBuffer = await generatePdfBuffer(itinerary.full_plan, trip);

    // Set headers for download
    const filename = `${trip.destination.replace(/\s+/g, '_')}_Itinerary_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF download error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;

