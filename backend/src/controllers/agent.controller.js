import agentQueue from "../queues/agentQueue.js";

export const startTripAgents = async (req, res) => {
  const { tripId } = req.params;

  await agentQueue.add({ tripId });

  res.json({ message: "Agent processing started", tripId });
};
