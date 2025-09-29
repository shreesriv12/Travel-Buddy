import Queue from "bull";
import { runAgents } from "../agents/orchestrator.js";

const agentQueue = new Queue("agent-tasks", process.env.REDIS_URL);

// Worker - runs automatically when jobs are added
agentQueue.process(async (job, done) => {
  const { tripId } = job.data;
  console.log("Processing agent task for trip:", tripId);

  try {
    const result = await runAgents(tripId);

    // Notify frontend that task is complete
    if (global.io) {
      global.io.emit(`agent-update-${tripId}`, {
        status: "completed",
        result,
      });
    }

    done();
  } catch (err) {
    console.error("Agent processing failed:", err);
    done(new Error(err));
  }
});

export default agentQueue;
