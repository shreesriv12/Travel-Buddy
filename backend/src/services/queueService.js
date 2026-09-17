import Bull from "bull";
import { createAlert } from "./alertService.js";

let alertQueue = null;

export function initializeQueues() {
  if (!process.env.REDIS_URL) {
    console.warn("REDIS_URL is not set: alerts use immediate local delivery; Bull durability is disabled.");
    return;
  }
  alertQueue = new Bull("travel-alerts", process.env.REDIS_URL);
  alertQueue.process(async (job) => createAlert(job.data));
  alertQueue.on("error", (error) => console.error("Bull queue error:", error.message));
  console.log("Bull/Redis travel-alerts queue enabled");
}

export async function enqueueAlert(alert) {
  if (alertQueue) return alertQueue.add(alert, { attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: true });
  return createAlert(alert);
}

export async function closeQueues() {
  await alertQueue?.close();
}
