import { Router } from "express";
import { runTripAgents } from "../controllers/agent.controller.js";

const router = Router();

router.post("/run", runTripAgents);

export default router;
