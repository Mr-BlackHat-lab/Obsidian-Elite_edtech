import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";
import { HttpError } from "../utils/httpError";

export function validateBody<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      next(new HttpError(422, "Validation failed", parsed.error.flatten()));
      return;
    }

    req.body = parsed.data;
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);

    if (!parsed.success) {
      next(new HttpError(422, "Validation failed", parsed.error.flatten()));
      return;
    }

    req.query = parsed.data;
    next();
  };
}
