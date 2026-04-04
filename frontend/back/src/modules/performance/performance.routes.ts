import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware";
import { getPerformance, addPerformanceResult } from "./performance.controller";

const router = Router();

router.get("/", requireAuth, getPerformance);
router.post("/", requireAuth, addPerformanceResult);

export default router;
