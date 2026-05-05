import { Router } from "express";
import { create, getAll, getById, remove, update } from "../controllers/department.controller";
import { validate } from "../middleware/validate.middleware";
import {
  authenticate,
  requirePasswordChanged,
  requirePrivilege,
} from "../middleware/auth.middleware";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from "../schemas/department.schemas";
import { idParamSchema } from "../schemas/employee.schemas";

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get("/", getAll);
router.get("/:id", validate({ params: idParamSchema }), getById);
router.post(
  "/",
  requirePrivilege("DepartmentCreate"),
  validate({ body: createDepartmentSchema }),
  create,
);
router.patch(
  "/:id",
  requirePrivilege("DepartmentEdit"),
  validate({ params: idParamSchema, body: updateDepartmentSchema }),
  update,
);
router.delete(
  "/:id",
  requirePrivilege("DepartmentDelete"),
  validate({ params: idParamSchema }),
  remove,
);

export default router;
