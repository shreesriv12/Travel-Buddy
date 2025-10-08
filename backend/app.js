import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import agentRoutes from './src/routes/agent.routes.js';
import tripRoutes from './src/routes/trip.routes.js';
import itineraryRoutes from './src/routes/itinerary.routes.js';
import calendarRoutes from './src/routes/calender.routes.js'
import cors from 'cors';

const app = express();

// ✅ Define corsOptions ONCE
const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization",
    "X-Google-Access-Token",    
    "X-Google-Refresh-Token"      
  ],
  credentials: true,
};

// ✅ Apply CORS once (this handles preflight automatically)
app.use(cors(corsOptions));

// ✅ Removed duplicate lines:
// app.use(cors(corsOptions)); 
// app.options('*', cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/calendar', calendarRoutes); 

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

export default app;