import cors, { type CorsOptions } from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env, getAllowedCorsOrigins } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRateLimiter } from "./middleware/rateLimiter";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/user/user.routes";
import performanceRoutes from "./modules/performance/performance.routes";

const app = express();
const allowedOrigins = getAllowedCorsOrigins();

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({
    message: "Auth API healthy",
  });
});

app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/performance", performanceRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
