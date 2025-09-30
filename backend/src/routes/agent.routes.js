// src/routes/agent.routes.js
import { Router } from "express";
import { runTripAgents } from "../controllers/agent.controller.js";

const router = Router();

// POST /api/agents/run/:tripId
router.post("/run/:tripId", runTripAgents);

export default router;
