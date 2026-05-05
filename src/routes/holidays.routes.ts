import { Router } from "express";
import { prisma } from "../config/prisma";
import { validate } from "../middleware/validate.middleware";
import {
  authenticate,
  requirePasswordChanged,
  requirePrivilege,
} from "../middleware/auth.middleware";
import { idParamSchema } from "../schemas/employee.schemas";
import { createHolidaySchema, holidayQuerySchema, updateHolidaySchema } from "../schemas/holiday.schema";
import { create, getAll, remove, update } from "../controllers/holiday.controller";



const router = Router();

router.use(authenticate, requirePasswordChanged);

// GET /api/holidays
router.get("/", validate({ query: holidayQuerySchema }), 
getAll);

// POST /api/holidays
router.post(
  "/",
  /*requirePrivilege("HolidayManage"),*/
  validate({ body: createHolidaySchema }),
  create
);

// PATCH /api/holidays/:id
router.patch(
  "/:id",
  /*requirePrivilege("HolidayManage"),*/
  validate({ params: idParamSchema, body: updateHolidaySchema }),
  update
);

// DELETE /api/holidays/:id
router.delete(
  "/:id",
  requirePrivilege(/*"HolidayManage"*/),
  validate({ params: idParamSchema }),
  remove);

export default router;
