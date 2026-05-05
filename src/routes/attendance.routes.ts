import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { validate } from "../middleware/validate.middleware";
import { authenticate, requirePrivilege } from "../middleware/auth.middleware";
import { sendSuccess } from "../utils/response.util";
import { AppError } from "../errors/app.error";
import { Prisma } from "@prisma/client";


const router = Router();

router.use(authenticate);


router.get(
  "/all",
  authenticate,
  requirePrivilege("AttendanceViewAll"),
  async (req, res, next) => {
    try {
      const { month, year, departmentId, employeeId } = req.query as Record<
        string,
        string
      >;

      // 1. Date Handling
      const now = new Date();
      const y = Number(year) || now.getFullYear();
      const m = Number(month) || now.getMonth() + 1;

      const startOfMonth = new Date(y, m - 1, 1);
      const endOfMonth = new Date(y, m, 0, 23, 59, 59);

      // 2. Identify the User and their Role/Position
      // req.user should include the 'role' and 'employee' relations
      const user = req.user!;
      const roleName = user.roleName; // "ADMIN", "MANAGER", "EMPLOYEE"

      const isAdminOrHr = roleName === "ADMIN" || roleName === "HR";
      let effectiveDeptId = departmentId;

      // 3. Manager Scoping Logic
      if (!isAdminOrHr) {
        // Find the department this employee manages based on the 'managerId' in the Department table
        const managedDept = await prisma.department.findFirst({
          where: { managerId: user.employeeId },
          select: { id: true },
        });

        if (managedDept) {
          // Force scope to their department, ignoring any departmentId in the query
          effectiveDeptId = managedDept.id;
        } else if (roleName !== "ADMIN" && roleName !== "HR") {
          // If they have the privilege but aren't an Admin/HR and don't manage a dept,
          // they shouldn't be seeing "all" records unless your business logic says otherwise.
          return res.status(403).json({
            success: false,
            message: "Access restricted: You do not manage a department.",
          });
        }
      }

      // 4. Construct Query
      const where: Prisma.AttendanceWhereInput = {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        // Filtering by Department via the Employee relation
        ...(effectiveDeptId && {
          employee: {
            departmentId: effectiveDeptId,
          },
        }),
        // Optional specific employee filter
        ...(employeeId && { employeeId }),
      };

      // 5. Fetch Records
      const records = await prisma.attendance.findMany({
        where,
        orderBy: [{ date: "desc" }, { employee: { lastName: "asc" } }],
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              avatarUrl: true,
              department: { select: { name: true } },
              jobPosition: { select: { title: true } }, // Pulls the "Jib Position"
            },
          },
        },
      });

      return sendSuccess(res, records);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/check-in",
  validate({ body: z.object({ notes: z.string().max(255).optional() }) }),
  async (req, res, next) => {
    try {
      const employeeId = req.user!.employeeId;
      if (!employeeId) throw new AppError("No employee profile found", 400);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await prisma.attendance.findUnique({
        where: { employeeId_date: { employeeId, date: today } },
      });
      if (existing?.checkIn)
        throw new AppError("Already checked in today", 409);

      const record = existing
        ? await prisma.attendance.update({
            where: { id: existing.id },
            data: {
              checkIn: new Date(),
              notes: req.body.notes as string | undefined,
            },
          })
        : await prisma.attendance.create({
            data: {
              employeeId,
              date: today,
              checkIn: new Date(),
              notes: req.body.notes as string | undefined,
            },
          });

      sendSuccess(res, record, "Checked in successfully");
    } catch (err) {
      next(err);
    }
  },
);

router.post("/check-out", async (req, res, next) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new AppError("No employee profile found", 400);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const record = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!record?.checkIn)
      throw new AppError("You have not checked in today", 400);
    if (record.checkOut) throw new AppError("Already checked out today", 409);

    const checkOut = new Date();
    const workedHours =
      (checkOut.getTime() - record.checkIn.getTime()) / (1000 * 60 * 60);

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { checkOut, workedHours: Math.round(workedHours * 100) / 100 },
    });

    sendSuccess(res, updated, "Checked out successfully");
  } catch (err) {
    next(err);
  }
});

router.get("/today", async (req, res, next) => {
  try {
    const employeeId = req.user!.employeeId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const record = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employeeId!, date: today } },
    });
    sendSuccess(res, record ?? null);
  } catch (err) {
    next(err);
  }
});

router.get("/my", async (req, res, next) => {
  try {
    const employeeId = req.user!.employeeId;
    const { month, year } = req.query as { month?: string; year?: string };
    const now = new Date();
    const y = Number(year) || now.getFullYear();
    const m = Number(month) || now.getMonth() + 1;

    const records = await prisma.attendance.findMany({
      where: {
        employeeId: employeeId!,
        date: {
          gte: new Date(y, m - 1, 1),
          lte: new Date(y, m, 0, 23, 59, 59),
        },
      },
      orderBy: { date: "asc" },
    });
    sendSuccess(res, records);
  } catch (err) {
    next(err);
  }
});

export default router;
