// src/services/realtimeListener.js
import { tripQueue } from '../config/queue.js';
import { getIO } from '../config/socket.js';

export function startRealtimeListener() {
  const io = getIO();

  console.log('[Realtime Listener] Initialized');

  // Listen for progress updates from the job queue
  tripQueue.on('progress', (job, progress) => {
    // A more detailed implementation could check job.data.userId to emit to a specific room
    console.log(`[Realtime Listener] Job ${job.id} progress: ${progress}%`);
    io.emit('job_progress', { jobId: job.id, progress });
  });

  // Listen for completion events
  tripQueue.on('completed', (job, result) => {
    console.log(`[Realtime Listener] Job ${job.id} completed. Result:`, result);
    // Emit to a specific user's room to notify them of completion
    if (job.data.userId) {
      io.to(`user:${job.data.userId}`).emit('trip_completed', {
        jobId: job.id,
        tripId: result.tripId,
        status: 'completed',
        result,
      });
    }
  });

  // Listen for failed jobs
  tripQueue.on('failed', (job, error) => {
    console.error(`[Realtime Listener] Job ${job.id} failed. Error:`, error.message);
    if (job.data.userId) {
      io.to(`user:${job.data.userId}`).emit('trip_failed', {
        jobId: job.id,
        status: 'failed',
        error: error.message,
      });
    }
  });
}