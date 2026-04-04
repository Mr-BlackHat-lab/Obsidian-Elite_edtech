import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { HttpError } from "../../utils/httpError";
import { authService } from "./auth.service";

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.signup(req.body);
  const message = data.verification.previewUrl
    ? "Signup successful. SMTP is not configured, use the dev preview link to verify your email."
    : "Signup successful. Please verify your email.";

  res.status(201).json({
    message,
    data,
  });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.verifyEmail(req.body);

  res.status(200).json({
    message: "Email verified successfully",
    data,
  });
});

export const verifyEmailFromQuery = asyncHandler(async (req: Request, res: Response) => {
  const token = req.query.token;

  if (typeof token !== "string") {
    throw new HttpError(422, "Token is required");
  }

  const data = await authService.verifyEmail({ token });

  res.status(200).json({
    message: "Email verified successfully",
    data,
  });
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.resendVerification(req.body);
  const message = data.verification?.previewUrl
    ? "Verification link generated in dev preview mode (SMTP not configured)."
    : data.message;

  res.status(200).json({
    message,
    data,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.login(req.body);

  res.status(200).json({
    message: "Login successful",
    data,
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.refreshToken(req.body);

  res.status(200).json({
    message: "Session refreshed",
    data,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.logout(req.body);

  res.status(200).json({
    message: "Logged out successfully",
    data,
  });
});
