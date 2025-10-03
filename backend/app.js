import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import agentRoutes from './src/routes/agent.routes.js';

const app = express();

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);

export default app;
