import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again shortly.",
  },
});
