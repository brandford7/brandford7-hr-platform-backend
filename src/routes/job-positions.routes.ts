import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { validate } from "../middleware/validate.middleware";
import {
  authenticate,
  requirePasswordChanged,
  requirePrivilege,
} from "../middleware/auth.middleware";
import { sendSuccess, sendCreated } from "../utils/response.util";

import { idParamSchema } from "../schemas/employee.schemas";
import { NotFoundError } from "../errors/notFound.error";

const router = Router();

router.use(authenticate, requirePasswordChanged);

const jobPositionSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  minSalary: z.number().positive().optional(),
  maxSalary: z.number().positive().optional(),
});

// GET /api/job-positions — all authenticated users (needed for employee form)
router.get("/", async (_req, res) => {
  const positions = await prisma.jobPosition.findMany({
    orderBy: { title: "asc" },
  });
  sendSuccess(res, positions);
});

// POST /api/job-positions
router.post(
  "/",
  requirePrivilege("JobPositionCreate"),
  validate({ body: jobPositionSchema }),
  async (req, res) => {
    const pos = await prisma.jobPosition.create({ data: req.body });
    sendCreated(res, pos, "Job position created");
  },
);

// PATCH /api/job-positions/:id
router.patch(
  "/:id",
  requirePrivilege("JobPositionEdit"),
  validate({ params: idParamSchema, body: jobPositionSchema.partial() }),
  async (req, res) => {
    const { id } = (req.validated?.params ?? req.params) as { id: string };
    const existing = await prisma.jobPosition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Job position");
    const pos = await prisma.jobPosition.update({
      where: { id },
      data: req.body,
    });
    sendSuccess(res, pos, "Job position updated");
  },
);

// DELETE /api/job-positions/:id
router.delete(
  "/:id",
  requirePrivilege("JobPositionEdit"),
  validate({ params: idParamSchema }),
  async (req, res) => {
    const { id } = (req.validated?.params ?? req.params) as { id: string };
    const existing = await prisma.jobPosition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Job position");
    await prisma.jobPosition.delete({ where: { id } });
    sendSuccess(res, null, "Job position deleted");
  },
);

export default router;
