import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

interface AccessJwtPayload extends JwtPayload {
  sub: string;
  email: string;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header("authorization");

  if (!header || !header.startsWith("Bearer ")) {
    next(new HttpError(401, "Missing Bearer token"));
    return;
  }

  const token = header.slice(7).trim();

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessJwtPayload;

    if (!decoded?.sub || typeof decoded.email !== "string") {
      next(new HttpError(401, "Invalid token payload"));
      return;
    }

    req.auth = {
      userId: decoded.sub,
      email: decoded.email,
    };

    next();
  } catch {
    next(new HttpError(401, "Invalid or expired access token"));
  }
}
