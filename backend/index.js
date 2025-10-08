// server.js
import dotenv from 'dotenv';
import cors from "cors";
import { createServer } from 'http';

dotenv.config();

import app from './app.js';
import { initializeSocket, getIO } from './src/config/socket.js';
import { tripQueue } from './src/config/queue.js';

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initializeSocket(httpServer);

// ==========================================
// REAL-TIME EVENT LISTENERS
// ==========================================

function emitToUser(userId, data) {
  try {
    const userRoom = `user:${userId}`;
    io.to(userRoom).emit('trip_update', data);
    console.log(`[Server] Emitted '${data.type}' to ${userRoom}`);
  } catch (error) {
    console.error('[Server] Failed to emit to user:', error.message);
  }
}

// Listen for job progress updates
tripQueue.on('progress', async (job, progress) => {
  console.log(`[Server] Job ${job.id} progress:`, JSON.stringify(progress));
  
  if (job.data.userId) {
    emitToUser(job.data.userId, {
      type: 'PROGRESS',
      jobId: job.id,
      tripId: progress.tripId || job.data.tripId,
      progress: progress.percent || 0,
      currentStep: progress.step || '',
      agent: progress.agent || '',
      message: progress.message || 'Processing...'
    });
  }
});

// Listen for job completion
tripQueue.on('completed', async (job, result) => {
  console.log(`[Server] Job ${job.id} completed`);
  
  if (job.data.userId) {
    emitToUser(job.data.userId, {
      type: 'COMPLETE',
      jobId: job.id,
      tripId: result.tripId,
      status: 'completed',
      message: 'Trip planning completed successfully!',
      result
    });
  }
});

// Listen for job failures
tripQueue.on('failed', async (job, err) => {
  console.error(`[Server] Job ${job?.id} failed:`, err.message);
  
  if (job?.data?.userId) {
    emitToUser(job.data.userId, {
      type: 'ERROR',
      jobId: job.id,
      tripId: job.data.tripId,
      status: 'failed',
      error: err.message,
      message: 'Trip planning failed'
    });
  }
});

// Queue error handler
tripQueue.on('error', (err) => {
  console.error('[Server] Queue error:', err);
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ WebSocket ready on ws://localhost:${PORT}`);
  console.log(`✅ Queue listeners active`);
});