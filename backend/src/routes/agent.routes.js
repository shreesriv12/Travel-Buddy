import { Router } from "express";
import { runTripAgents } from "../controllers/agent.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Protect the route with authentication middleware
router.post("/run", authenticate, runTripAgents);

export default router;