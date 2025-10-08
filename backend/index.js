import dotenv from 'dotenv';
import cors from "cors";

dotenv.config();

import app from './app.js';
import cronService from './src/services/cronServices.js';

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:3000", // your Next.js frontend
  credentials: true, // allow cookies if you ever use them
}));


const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
  console.log(`🤖 Gemini: ${process.env.GOOGLE_API_KEY ? 'Configured' : 'Not configured'}`);
  
  // Initialize cron jobs AFTER server starts
  try {
    cronService.init();
    console.log('✅ Cron jobs initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize cron jobs:', error.message);
  }
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🛑 Received shutdown signal...');
  
  // Stop cron jobs first
  cronService.stop();
  console.log('✅ Cron jobs stopped');
  
  // Then close server
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});