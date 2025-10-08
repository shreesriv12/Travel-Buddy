// src/controllers/agent.controller.js

import { tripQueue } from "../config/queue.js";

export async function runTripAgents(req, res) {
  const userId = req.user?.userId;
  const { prompt } = req.body;

  console.log('[Agent Controller] Request received from user:', userId);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized - please login" });
  }

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    console.log('[Agent Controller] Adding job to queue...');
    
    // Add job to queue for background processing
    const job = await tripQueue.add('process-trip', {
      userId,
      prompt
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    console.log(`[Agent Controller] Job ${job.id} created successfully`);

    // Immediately return with job ID
    res.status(202).json({
      message: "Trip planning started. You'll receive real-time updates via WebSocket.",
      jobId: job.id,
      status: "processing"
    });

  } catch (err) {
    console.error("[Agent Controller] Failed to create job:", err);
    res.status(500).json({ 
      error: "Failed to start trip planning",
      message: err.message 
    });
  }
}