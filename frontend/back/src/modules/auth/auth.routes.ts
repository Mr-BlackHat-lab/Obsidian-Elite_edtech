import { Router } from "express";
import { validateBody, validateQuery } from "../../middleware/validate";
import {
  login,
  logout,
  refreshToken,
  resendVerification,
  signup,
  verifyEmail,
  verifyEmailFromQuery,
} from "./auth.controller";
import {
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  resendVerificationSchema,
  signupSchema,
  verifyEmailQuerySchema,
  verifyEmailSchema,
} from "./auth.validators";

const router = Router();

router.post("/signup", validateBody(signupSchema), signup);
router.post("/verify-email", validateBody(verifyEmailSchema), verifyEmail);
router.get("/verify-email", validateQuery(verifyEmailQuerySchema), verifyEmailFromQuery);
router.post(
  "/resend-verification",
  validateBody(resendVerificationSchema),
  resendVerification,
);
router.post("/login", validateBody(loginSchema), login);
router.post("/refresh-token", validateBody(refreshTokenSchema), refreshToken);
router.post("/logout", validateBody(logoutSchema), logout);

export default router;
