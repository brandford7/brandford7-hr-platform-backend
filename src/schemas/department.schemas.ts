import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  managerId: z.uuid().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  managerId: z.uuid().nullable().optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
