import { z } from "zod";
import { EmploymentType, EmployeeStatus, Gender } from "@prisma/client";

export const createEmployeeSchema = z.object({
  email: z.email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  middleName: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  gender: z.enum(Gender).optional(),
  dateOfBirth: z.iso.datetime().optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  departmentId: z.uuid().optional(),
  jobPositionId: z.uuid().optional(),
  roleId: z.uuid(),
  employmentType: z.enum(EmploymentType).default("FULL_TIME"),
  salary: z.number().positive().optional(),
  hireDate: z.iso.datetime(),
  bio: z.string().max(500).optional(),
  emergencyContact: z.string().max(255).optional(),
  // Optional: admin can set a specific temp password. If omitted, one is auto-generated.
  temporaryPassword: z.string().min(8).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema
  .omit({ email: true, password: true, roleId: true })
  .partial();

export const employeeQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.enum(EmployeeStatus).optional(),
  employmentType: z.enum(EmploymentType).optional(),
  sortBy: z
    .enum(["firstName", "lastName", "createdAt", "hireDate", "salary"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const idParamSchema = z.object({ id: z.uuid("Invalid ID") });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeQuery = z.infer<typeof employeeQuerySchema>;
