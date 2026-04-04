import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    message: "Route not found",
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      message: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      message: "Validation failed",
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof Error && err.message.includes("Origin not allowed by CORS")) {
    res.status(403).json({ message: err.message });
    return;
  }

  if (err instanceof Error) {
    res.status(500).json({
      message: "Internal server error",
      ...(env.NODE_ENV === "development" ? { details: err.message } : {}),
    });
    return;
  }

  res.status(500).json({
    message: "Internal server error",
  });
}
