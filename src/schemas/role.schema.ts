import z from "zod";


export const createRoleSchema = z.object({
  name: z.string().min(2).max(50).toUpperCase(),
  displayName: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

export const createDutySchema = z.object({
  name: z.string().min(2).max(100),
  displayName: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  privilegeIds: z
    .array(z.uuid())
    .min(1, "At least one privilege required"),
});

export const updateDutySchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  privilegeIds: z.array(z.uuid()).optional(),
});

export const createPrivilegeSchema = z.object({
  name: z.string().min(2).max(100),
  resource: z.string().min(2).max(50),
  action: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
});

export const assignDutiesSchema = z.object({
  dutyIds: z.array(z.uuid()).min(1, "Select at least one duty"),
});
