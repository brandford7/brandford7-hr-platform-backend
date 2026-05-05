import { z } from "zod";

export const createHolidaySchema = z.object({
  name: z.string().min(2).max(100),
  date: z.string().datetime(),
  description: z.string().max(500).optional(),
  isRecurring: z.boolean().default(false),
});

export const updateHolidaySchema = createHolidaySchema.partial();

export const holidayQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .default(new Date().getFullYear()),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
export type HolidayQuery = z.infer<typeof holidayQuerySchema>;
