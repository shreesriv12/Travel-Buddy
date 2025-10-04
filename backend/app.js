import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import agentRoutes from './src/routes/agent.routes.js';
import cors from 'cors';
const app = express();
// Enable CORS
app.use(
  cors({
    origin: "http://localhost:3000", // your Next.js frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"], // allow auth header
    credentials: true, // needed if using cookies
  })
);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);

export default app;
