import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { createLoginRateLimiter } from "../middleware/login-rate-limit.js";
import { validateRequest } from "../middleware/validate-request.js";
import { loginSchema } from "../models/auth.schemas.js";

export function createAuthRouter({ authController, authenticate }) {
  const router = Router();
  const loginRateLimiter = createLoginRateLimiter();

  router.post(
    "/login",
    loginRateLimiter,
    validateRequest(loginSchema),
    asyncHandler(authController.login)
  );
  router.get("/me", authenticate, asyncHandler(authController.me));

  return router;
}
