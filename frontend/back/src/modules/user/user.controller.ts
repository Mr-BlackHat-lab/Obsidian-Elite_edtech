import type { Request, Response } from "express";
import { authService } from "../auth/auth.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../utils/httpError";

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const user = await authService.getUserById(req.auth.userId);

  res.status(200).json({
    message: "Authenticated user profile",
    data: {
      user,
    },
  });
});
