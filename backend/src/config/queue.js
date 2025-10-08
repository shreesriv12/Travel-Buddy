// src/config/queue.js
import pkg from 'bullmq';
const { Queue } = pkg;

// Define the Redis connection
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

console.log('[Queue] Redis connection details:', {
  host: connection.host,
  port: connection.port,
});

// Create a new queue for trip planning jobs
export const tripQueue = new Queue('trip-planning-queue', { 
  connection,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 200, // Keep last 200 failed jobs
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: 'exponential',
      delay: 2000 // Start with 2 second delay
    }
  }
});

// Listen for global events to confirm connection status
tripQueue.on('ready', () => {
  console.log('[Queue] ✅ Trip queue is ready and connected to Redis');
});

tripQueue.on('error', (err) => {
  console.error('[Queue] ❌ Queue error:', err);
});

// Export connection config for worker
export { connection };