// app.js
import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import agentRoutes from './src/routes/agent.routes.js';
import tripRoutes from './src/routes/trip.routes.js'; // Add this
import cors from 'cors';

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api', tripRoutes); // Add this

export default app;