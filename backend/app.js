import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import tripsRoutes from './src/routes/trips.routes.js';

const app = express();

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripsRoutes);

export default app;
