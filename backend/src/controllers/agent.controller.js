import prisma from "../config/db.js";
import { runMCPOrchestrator } from "../agents/orchestrator.js";

export async function runTripAgents(req, res) {
  const { tripId } = req.params;

  try {
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });

    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const result = await runMCPOrchestrator(trip, { maxSteps: 4 });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
