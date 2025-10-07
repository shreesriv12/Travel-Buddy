import { createTripAndRunOrchestrator } from "../agents/tripAgent.js";

export async function runTripAgents(req, res) {
  // Get userId from authenticated user (set by middleware)
  const userId = req.user?.userId;
  const { prompt } = req.body;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized - please login" });
  }

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const tripWithOrchestrator = await createTripAndRunOrchestrator({ 
      userId, 
      prompt 
    });

    res.json(tripWithOrchestrator);

  } catch (err) {
    console.error("Trip workflow failed:", err);
    res.status(500).json({ error: err.message });
  }
}