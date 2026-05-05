import type { Request } from "express";
import { prisma } from "../config/prisma";
import { writeAuditLog } from "../utils/audit.util";
import { CreateHolidayInput, HolidayQuery, UpdateHolidayInput } from "../schemas/holiday.schema";
import { ConflictError } from "../errors/conflict.error";
import { NotFoundError } from "../errors/notFound.error";



export type HolidayRecord = {
  id: string;
  name: string;
  date: Date;
  year: number;
  description: string | null;
  isRecurring: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};


/**
 * Returns all holidays for a given year, plus all recurring holidays
 * (which apply to every year regardless of their stored year).
 */
export async function getHolidaysByYear(
  query: HolidayQuery,
): Promise<HolidayRecord[]> {
  return prisma.holiday.findMany({
    where: {
      OR: [{ year: query.year }, { isRecurring: true }],
    },
    orderBy: { date: "asc" },
  });
}

/**
 * Creates a new holiday. Prevents duplicate dates.
 */
export async function createHoliday(
  input: CreateHolidayInput,
  req: Request,
): Promise<HolidayRecord> {
  const date = new Date(input.date);
  const year = date.getFullYear();

  // Normalize to midnight UTC for consistent date-only comparison
  date.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.holiday.findUnique({ where: { date } });
  if (existing) {
    throw new ConflictError(
      `A holiday already exists on ${date.toDateString()} ("${existing.name}")`,
    );
  }

  const holiday = await prisma.holiday.create({
    data: {
      name: input.name,
      date,
      year,
      description: input.description,
      isRecurring: input.isRecurring ?? false,
      createdById: req.user!.userId,
    },
  });

  await writeAuditLog({
    userId: req.user!.userId,
    action: "CREATE",
    resource: "holidays",
    resourceId: holiday.id,
    newValues: { name: holiday.name, date: holiday.date.toISOString(), year },
    req,
  });

  return holiday;
}

/**
 * Updates an existing holiday's fields. Re-validates the date if it changes.
 */
export async function updateHoliday(
  id: string,
  input: UpdateHolidayInput,
  req: Request,
): Promise<HolidayRecord> {
  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Holiday");

  let date: Date | undefined;
  let year: number | undefined;

  if (input.date) {
    date = new Date(input.date);
    date.setUTCHours(0, 0, 0, 0);
    year = date.getFullYear();

    // Check that the new date doesn't clash with a different holiday
    const clash = await prisma.holiday.findFirst({
      where: { date, id: { not: id } },
    });
    if (clash) {
      throw new ConflictError(
        `Another holiday already exists on ${date.toDateString()} ("${clash.name}")`,
      );
    }
  }

  const holiday = await prisma.holiday.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      isRecurring: input.isRecurring,
      ...(date && { date, year }),
    },
  });

  await writeAuditLog({
    userId: req.user!.userId,
    action: "UPDATE",
    resource: "holidays",
    resourceId: id,
    oldValues: { name: existing.name, date: existing.date.toISOString() },
    newValues: { name: holiday.name, date: holiday.date.toISOString() },
    req,
  });

  return holiday;
}

/**
 * Permanently deletes a holiday.
 */
export async function deleteHoliday(id: string, req: Request): Promise<void> {
  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Holiday");

  await prisma.holiday.delete({ where: { id } });

  await writeAuditLog({
    userId: req.user!.userId,
    action: "DELETE",
    resource: "holidays",
    resourceId: id,
    oldValues: { name: existing.name, date: existing.date.toISOString() },
    req,
  });
}
