// src/workers/tripProcessor.js
import { Worker } from 'bullmq';
import { createTripAndRunOrchestrator } from '../agents/tripAgent.js';

// Redis connection configuration
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

console.log('[Worker] Initializing trip processor...');

// Create worker instance
const tripWorker = new Worker('trip-planning-queue', async (job) => {
  const { userId, prompt } = job.data;
  
  console.log(`[Worker] Processing trip for user ${userId}`);
  
  // Update job progress - this will be picked up by server listeners
  await job.updateProgress({
    percent: 0,
    step: 'parsing',
    message: 'Analyzing your trip request...'
  });
  
  try {
    // Call the orchestrator with job reference for progress updates
    const result = await createTripAndRunOrchestrator({ 
      userId, 
      prompt,
      job // Pass job for progress tracking
    });
    
    console.log(`[Worker] Trip ${result.tripId} completed successfully`);
    
    // Final progress update
    await job.updateProgress({
      percent: 100,
      step: 'complete',
      message: 'Trip planning completed!'
    });
    
    return result;
  } catch (error) {
    console.error(`[Worker] Trip processing failed:`, error);
    
    // Update progress with error
    await job.updateProgress({
      percent: 0,
      step: 'error',
      message: `Failed: ${error.message}`
    });
    
    throw error;
  }
}, { 
  connection,
  concurrency: 3, // Process up to 3 jobs simultaneously
  limiter: {
    max: 10, // Max 10 jobs
    duration: 60000 // Per minute
  }
});

// Worker event handlers
tripWorker.on('completed', (job, result) => {
  console.log(`[Worker] ✅ Job ${job.id} completed for trip ${result.tripId}`);
});

tripWorker.on('failed', (job, err) => {
  console.error(`[Worker] ❌ Job ${job?.id} failed:`, err.message);
});

tripWorker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

tripWorker.on('ready', () => {
  console.log('[Worker] ✅ Trip processor ready and connected to Redis');
});

console.log('[Worker] Trip processor initialized');

export { tripWorker };