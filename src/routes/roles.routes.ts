import { Router } from "express";
import { z } from "zod";
import * as securityController from "../controllers/security.controller";
import { validate } from "../middleware/validate.middleware";
import {
  authenticate,
  requirePasswordChanged,
  requirePrivilege,
} from "../middleware/auth.middleware";
import { idParamSchema } from "../schemas/employee.schemas";
import { assignDutiesSchema, createDutySchema, createPrivilegeSchema, createRoleSchema, updateDutySchema } from "../schemas/role.schema";

const router = Router();

router.use(authenticate, requirePasswordChanged);

//  Role routes 

// GET  /api/roles          — all authenticated users (needed for role dropdowns)
router.get("/", securityController.getRoles);

// POST /api/roles          — create new role (admin only)
router.post(
  "/",
  requirePrivilege("RoleManage"),
  validate({ body: createRoleSchema }),
  securityController.createRoleHandler,
);

// POST /api/roles/:id/duties    — assign duties to role
router.post(
  "/:id/duties",
  requirePrivilege("RoleManage"),
  validate({ params: idParamSchema, body: assignDutiesSchema }),
  securityController.assignDuties,
);

// DELETE /api/roles/:id/duties/:dutyId  — remove single duty from role
router.delete(
  "/:id/duties/:dutyId",
  requirePrivilege("RoleManage"),
  securityController.removeDuty,
);

// ── Duty routes ───────────────────────────────────────────────────────────────

// GET   /api/roles/duties
router.get(
  "/duties",
  requirePrivilege("RoleView"),
  securityController.getDuties,
);

// POST  /api/roles/duties
router.post(
  "/duties",
  requirePrivilege("RoleManage"),
  validate({ body: createDutySchema }),
  securityController.createDutyHandler,
);

// PATCH /api/roles/duties/:id
router.patch(
  "/duties/:id",
  requirePrivilege("RoleManage"),
  validate({ params: idParamSchema, body: updateDutySchema }),
  securityController.updateDutyHandler,
);

// ── Privilege routes ──────────────────────────────────────────────────────────

// GET  /api/roles/privileges
router.get(
  "/privileges",
  requirePrivilege("RoleView"),
  securityController.getPrivileges,
);

// POST /api/roles/privileges
router.post(
  "/privileges",
  requirePrivilege("RoleManage"),
  validate({ body: createPrivilegeSchema }),
  securityController.createPrivilegeHandler,
);

export default router;
