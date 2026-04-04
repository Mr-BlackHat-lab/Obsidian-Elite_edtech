import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware";
import { me } from "./user.controller";

const router = Router();

router.get("/me", requireAuth, me);

export default router;
