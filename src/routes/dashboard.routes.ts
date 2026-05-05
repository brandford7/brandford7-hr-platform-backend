import { Router } from "express";
import { getStats } from "../controllers/dashboard.controller";
import { authenticate, requirePrivilege } from "../middleware/auth.middleware";

const router = Router();

router.get(
  "/stats",
  authenticate,
  //requirePrivilege("dashboard:read"),
  getStats,
);

export default router;
