import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../config/prisma";
import { AppError } from "../errors/app.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/notFound.error"; 
import { writeAuditLog } from "../utils/audit.util";
import {
  countBusinessDays,
  validateLeaveDates,
  calculateResumptionDate,
} from "../utils/calendar.util";
import type {
  CreateLeaveRequestInput,
  ReviewLeaveInput,
  BulkReviewLeaveInput,
  LeaveQuery,
} from "../schemas/leave.schemas";

const LEAVE_SELECT = {
  id: true,
  startDate: true,
  endDate: true,
  resumptionDate: true,
  totalDays: true,
  reason: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  reviewedById: true,
  createdAt: true,
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      avatarUrl: true,
      department: { select: { name: true } },
    },
  },
  leaveType: { select: { id: true, name: true, colorHex: true, isPaid: true } },
} satisfies Prisma.LeaveRequestSelect;

export async function getAllLeaveRequests(
  query: LeaveQuery,
  requestingUser: NonNullable<Request["user"]>,
) {
  const {
    page,
    limit,
    status,
    employeeId,
    departmentId,
    leaveTypeId,
    startDate,
    endDate,
    sortOrder,
    search,
  } = query;
  const skip = (page - 1) * limit;

  // Employees only see their own requests
  const isEmployee = requestingUser.roleName === "EMPLOYEE";
  const filterEmployeeId = isEmployee
    ? (requestingUser.employeeId ?? undefined)
    : employeeId;

  const where: Prisma.LeaveRequestWhereInput = {
    ...(filterEmployeeId && { employeeId: filterEmployeeId }),
    ...(status && { status }),
    ...(leaveTypeId && { leaveTypeId }),
    ...(startDate && { startDate: { gte: new Date(startDate) } }),
    ...(endDate && { endDate: { lte: new Date(endDate) } }),
    // Filter by department via the employee relation
    ...(departmentId && { employee: { departmentId } }),
    // Search by employee name or code
    ...(search && {
      employee: {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { employeeCode: { contains: search, mode: "insensitive" as const } },
        ],
      },
    }),
  };

  const [requests, total] = await prisma.$transaction([
    prisma.leaveRequest.findMany({
      where,
      select: LEAVE_SELECT,
      orderBy: { createdAt: sortOrder },
      skip,
      take: Number(limit),
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { requests, total, page, limit };
}

export async function getLeaveRequestById(id: string) {
  const req = await prisma.leaveRequest.findUnique({
    where: { id },
    select: LEAVE_SELECT,
  });
  if (!req) throw new NotFoundError("Leave request");
  return req;
}

export async function createLeaveRequest(
  input: CreateLeaveRequestInput,
  req: Request,
) {
  const employeeId = req.user!.employeeId;
  if (!employeeId)
    throw new AppError("No employee profile linked to this account", 400);

  const leaveType = await prisma.leaveType.findUnique({
    where: { id: input.leaveTypeId, isActive: true },
  });
  if (!leaveType) throw new NotFoundError("Leave type");

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  // ── Weekend + holiday validation ──────────────────────────────────────────
  const dateError = await validateLeaveDates(startDate, endDate);
  if (dateError) throw new AppError(dateError, 400);

  // ── Count only real business days (excludes weekends + holidays) ──────────
  const totalDays = await countBusinessDays(startDate, endDate);

  if (totalDays === 0)
    throw new AppError(
      "Leave request must span at least one business day",
      400,
    );

  if (leaveType.maxConsecutiveDays && totalDays > leaveType.maxConsecutiveDays)
    throw new AppError(
      `${leaveType.name} allows a maximum of ${leaveType.maxConsecutiveDays} consecutive days`,
      400,
    );

  // ── Overlap detection ─────────────────────────────────────────────────────
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlapping)
    throw new AppError(
      "You have an overlapping leave request for this period",
      409,
    );

  // ── Leave balance check (auto-create if missing) ──────────────────────────
  const year = new Date().getFullYear();
  let balance = await prisma.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId,
        leaveTypeId: input.leaveTypeId,
        year,
      },
    },
  });

  if (!balance) {
    balance = await prisma.leaveBalance.create({
      data: {
        employeeId,
        leaveTypeId: input.leaveTypeId,
        year,
        totalDays: leaveType.defaultDays,
      },
    });
  }

  const available = balance.totalDays - balance.usedDays - balance.pendingDays;
  if (available < totalDays)
    throw new AppError(
      `Insufficient balance. Available: ${available} day(s), Requested: ${totalDays} day(s)`,
      400,
    );

  // ── Resumption date (first working day after leave ends) ──────────────────
  const resumptionDate = await calculateResumptionDate(endDate);

  // ── Create request + reserve pending days atomically ──────────────────────
  const [leaveRequest] = await prisma.$transaction([
    prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: input.leaveTypeId,
        startDate,
        endDate,
        resumptionDate,
        totalDays,
        reason: input.reason,
      },
      select: LEAVE_SELECT,
    }),
    prisma.leaveBalance.update({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId: input.leaveTypeId,
          year,
        },
      },
      data: { pendingDays: { increment: totalDays } },
    }),
  ]);

  await writeAuditLog({
    userId: req.user!.userId,
    action: "CREATE",
    resource: "leave_requests",
    resourceId: leaveRequest.id,
    req,
  });

  return leaveRequest;
}

export async function reviewLeaveRequest(
  id: string,
  input: ReviewLeaveInput,
  req: Request,
) {
  const leaveReq = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveReq) throw new NotFoundError("Leave request");
  if (leaveReq.status !== "PENDING")
    throw new AppError("Only pending requests can be reviewed", 400);

  const year = leaveReq.startDate.getFullYear();

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.leaveRequest.update({
      where: { id },
      data: {
        status: input.status,
        reviewNote: input.reviewNote,
        reviewedAt: new Date(),
        reviewedById: req.user!.employeeId,
      },
      select: LEAVE_SELECT,
    });

    if (input.status === "APPROVED") {
      await tx.leaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: leaveReq.employeeId,
            leaveTypeId: leaveReq.leaveTypeId,
            year,
          },
        },
        data: {
          pendingDays: { decrement: leaveReq.totalDays },
          usedDays: { increment: leaveReq.totalDays },
        },
      });
    } else {
      // Rejected — release reserved pending days
      await tx.leaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: leaveReq.employeeId,
            leaveTypeId: leaveReq.leaveTypeId,
            year,
          },
        },
        data: { pendingDays: { decrement: leaveReq.totalDays } },
      });
    }

    return result;
  });

  await writeAuditLog({
    userId: req.user!.userId,
    action: input.status === "APPROVED" ? "APPROVE" : "REJECT",
    resource: "leave_requests",
    resourceId: id,
    req,
  });

  return updated;
}

export async function bulkReviewLeaveRequests(
  input: BulkReviewLeaveInput,
  req: Request,
) {
  const results = await Promise.allSettled(
    input.ids.map((id) =>
      reviewLeaveRequest(
        id,
        { status: input.status, reviewNote: input.reviewNote },
        req,
      ),
    ),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return { succeeded, failed, total: input.ids.length };
}

export async function cancelLeaveRequest(id: string, req: Request) {
  const leaveReq = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveReq) throw new NotFoundError("Leave request");

  if (req.user!.roleName === "EMPLOYEE") {
    if (leaveReq.employeeId !== req.user!.employeeId)
      throw new ForbiddenError();
    if (leaveReq.status !== "PENDING")
      throw new AppError("Only pending requests can be cancelled", 400);
  }

  const year = leaveReq.startDate.getFullYear();

  await prisma.$transaction([
    prisma.leaveRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    }),
    ...(leaveReq.status === "PENDING"
      ? [
          prisma.leaveBalance.update({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: leaveReq.employeeId,
                leaveTypeId: leaveReq.leaveTypeId,
                year,
              },
            },
            data: { pendingDays: { decrement: leaveReq.totalDays } },
          }),
        ]
      : []),
  ]);

  await writeAuditLog({
    userId: req.user!.userId,
    action: "UPDATE",
    resource: "leave_requests",
    resourceId: id,
    newValues: { status: "CANCELLED" },
    req,
  });
}

export async function getMyLeaveBalances(req: Request) {
  const employeeId = req.user!.employeeId;
  if (!employeeId) throw new AppError("No employee profile found", 400);

  const year = new Date().getFullYear();
  const balances = await prisma.leaveBalance.findMany({
    where: { employeeId, year },
    include: {
      leaveType: {
        select: { id: true, name: true, colorHex: true, isPaid: true },
      },
    },
  });

  return balances.map((b) => ({
    leaveType: b.leaveType,
    year: b.year,
    totalDays: b.totalDays,
    usedDays: b.usedDays,
    pendingDays: b.pendingDays,
    availableDays: b.totalDays - b.usedDays - b.pendingDays,
  }));
}
