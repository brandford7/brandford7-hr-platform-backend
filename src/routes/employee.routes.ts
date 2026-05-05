import { Router } from "express";
import {
  create,
  getAll,
  getById,
  getMe,
  remove,
  update,
} from "../controllers/employee.controller";
import { validate } from "../middleware/validate.middleware";
import {
  authenticate,
  requirePasswordChanged,
  requirePrivilege,
  requireOwnerOrPrivilege,
} from "../middleware/auth.middleware";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
  idParamSchema,
} from "../schemas/employee.schemas";

const router = Router();

// All employee routes require a valid token + password already set
router.use(authenticate, requirePasswordChanged);

// Own profile — any authenticated user
router.get("/me", getMe);

// List employees
router.get(
  "/",
  requirePrivilege("EmployeeView"),
  validate({ query: employeeQuerySchema }),
  getAll,
);

// View single employee — own record OR EmployeeView privilege
router.get(
  "/:id",
  validate({ params: idParamSchema }),
  requireOwnerOrPrivilege((req) => req.params.id! as string, "EmployeeView"),
  getById,
);

// Create / Update / Delete — admin/HR only
router.post(
  "/",
  requirePrivilege("EmployeeCreate"),
  validate({ body: createEmployeeSchema }),
  create,
);
router.patch(
  "/:id",
  requirePrivilege("EmployeeEdit"),
  validate({ params: idParamSchema, body: updateEmployeeSchema }),
  update,
);
router.delete(
  "/:id",
  requirePrivilege("EmployeeDelete"),
  validate({ params: idParamSchema }),
  remove,
);

export default router;
