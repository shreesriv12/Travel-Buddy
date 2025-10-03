import { createTripAndRunOrchestrator } from "../agents/tripAgent.js"; // updated import

export async function runTripAgents(req, res) {
  const { userId, prompt } = req.body;

  if (!userId || !prompt) {
    return res.status(400).json({ error: "userId and prompt are required" });
  }

  try {
    const tripWithOrchestrator = await createTripAndRunOrchestrator({ userId, prompt });

    res.json(tripWithOrchestrator);

  } catch (err) {
    console.error("Trip workflow failed:", err);
    res.status(500).json({ error: err.message });
  }
}
