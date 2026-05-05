import { z } from "zod";
import { LeaveStatus } from "@prisma/client";

export const createLeaveRequestSchema = z
  .object({
    leaveTypeId: z.uuid(),
    startDate: z.iso.datetime(),
    endDate: z.iso.datetime(),
    reason: z
      .string()
      .min(10, "Reason must be at least 10 characters")
      .max(500),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export const reviewLeaveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(500).optional(),
});

export const bulkReviewLeaveSchema = z.object({
  ids: z.array(z.uuid()).min(1, "Select at least one request"),
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(500).optional(),
});

export const leaveQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  status: z.enum(LeaveStatus).optional(),
  employeeId: z.uuid().optional(),
  leaveTypeId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const leaveTypeSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  defaultDays: z.number().int().min(1).max(365),
  isPaid: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  maxConsecutiveDays: z.number().int().positive().optional(),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#3B82F6"),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;
export type BulkReviewLeaveInput = z.infer<typeof bulkReviewLeaveSchema>;
export type LeaveQuery = z.infer<typeof leaveQuerySchema>;
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;
