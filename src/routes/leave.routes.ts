import { Router } from "express";
import * as ctrl from "../controllers/leave.controller";
import { validate } from "../middleware/validate.middleware";
import {
  authenticate,
  requirePasswordChanged,
  requirePrivilege,
} from "../middleware/auth.middleware";
import {
  createLeaveRequestSchema,
  reviewLeaveSchema,
  bulkReviewLeaveSchema,
  leaveQuerySchema,
} from "../schemas/leave.schemas";
import { idParamSchema } from "../schemas/employee.schemas";

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get("/balances", ctrl.getBalances);
router.get("/", validate({ query: leaveQuerySchema }), ctrl.getAll);
router.get("/:id", validate({ params: idParamSchema }), ctrl.getById);
router.post("/", validate({ body: createLeaveRequestSchema }), ctrl.create);

// bulk-review BEFORE /:id to avoid route collision
router.patch(
  "/bulk-review",
  requirePrivilege("LeaveApprove"),
  validate({ body: bulkReviewLeaveSchema }),
  ctrl.bulkReview,
);
router.patch(
  "/:id/review",
  requirePrivilege("LeaveApprove"),
  validate({ params: idParamSchema, body: reviewLeaveSchema }),
  ctrl.review,
);
router.patch("/:id/cancel", validate({ params: idParamSchema }), ctrl.cancel);

export default router;
