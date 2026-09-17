import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import agentRoutes from './src/routes/agent.routes.js';
import tripRoutes from './src/routes/trip.routes.js';
import itineraryRoutes from './src/routes/itinerary.routes.js';
import calendarRoutes from './src/routes/calender.routes.js'
import cronRoutes from './src/routes/cron.routes.js';
import notificationRoutes from './src/routes/notification.routes.js';

const app = express();

// ✅ Define corsOptions ONCE
const allowedOrigins = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];
const corsOptions = {
  origin(origin, callback) {
    // Browsers send an Origin header; tools such as curl/Postman generally do not.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
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
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Google-Access-Token,X-Google-Refresh-Token");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

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
app.use('/api/cron', cronRoutes);
app.use('/api/notifications', notificationRoutes);


// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

export default app;
