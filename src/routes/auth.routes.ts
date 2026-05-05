import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middleware/validate.middleware";
import {
  authenticate,
  requirePasswordChanged,
} from "../middleware/auth.middleware";
import { loginSchema, changePasswordSchema, setInitialPasswordSchema } from "../schemas/auth.schemas";

const router = Router();

// ── Public routes (no auth required) ─────────────────────────────────────────
router.post("/login", validate({ body: loginSchema }), authController.login);
router.post("/refresh", authController.refresh);

// ── Requires valid token (but mustChangePassword may still be true) ───────────
router.post(
  "/set-password",
  authenticate,
  validate({ body: setInitialPasswordSchema }),
  authController.setInitialPassword,
);

// ── Requires valid token + password already changed ───────────────────────────
router.get("/me", authenticate, requirePasswordChanged, authController.getMe);
router.post(
  "/logout",
  authenticate,
  requirePasswordChanged,
  authController.logout,
);
router.patch(
  "/change-password",
  authenticate,
  requirePasswordChanged,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

export default router;
