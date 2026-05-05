import { prisma } from "../config/prisma";


 // Returns true if the given date falls on a Saturday or Sunday.
 
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Fetches all holiday dates for a given year from the database.
 * Results are cached per year within the same process tick via a simple Map.
 */
const holidayCache = new Map<number, Set<string>>();

export async function getHolidayDates(year: number): Promise<Set<string>> {
  if (holidayCache.has(year)) return holidayCache.get(year)!;

  const holidays = await prisma.holiday.findMany({
    where: {
      OR: [
        { year },
        { isRecurring: true }, // recurring holidays apply every year
      ],
    },
    select: { date: true },
  });

  // Normalise to ISO date strings (YYYY-MM-DD) for fast Set lookup
  const dateSet = new Set(
    holidays.map((h) => {
      const d = new Date(h.date);
      // For recurring holidays, substitute the queried year
      const effectiveYear = year;
      return `${effectiveYear}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
  );

  holidayCache.set(year, dateSet);

  // Expire cache after 5 minutes so seeded holidays are picked up quickly
  setTimeout(() => holidayCache.delete(year), 5 * 60 * 1000);

  return dateSet;
}

/**
 * Returns true if the date is a weekend OR a public holiday.
 */
export async function isNonWorkingDay(date: Date): Promise<boolean> {
  if (isWeekend(date)) return true;
  const key = toDateKey(date);
  const holidays = await getHolidayDates(date.getFullYear());
  return holidays.has(key);
}

/**
 * Converts a Date to a YYYY-MM-DD string for holiday Set lookup.
 */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Counts business days between two dates (inclusive), excluding weekends and holidays.
 */
export async function countBusinessDays(
  start: Date,
  end: Date,
): Promise<number> {
  const years = new Set<number>();
  const cur = new Date(start);
  while (cur <= end) {
    years.add(cur.getFullYear());
    cur.setDate(cur.getDate() + 1);
  }

  // Fetch holidays for all years spanned by this range
  const holidaySets = await Promise.all([...years].map(getHolidayDates));
  const allHolidays = new Set(holidaySets.flatMap((s) => [...s]));

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    const key = toDateKey(cursor);
    if (day !== 0 && day !== 6 && !allHolidays.has(key)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

/**
 * Returns the first working day AFTER the given end date.
 * This is the employee's resumption date.
 * Skips weekends and public holidays.
 */
export async function calculateResumptionDate(endDate: Date): Promise<Date> {
  const cursor = new Date(endDate);
  cursor.setDate(cursor.getDate() + 1); // start from the day after leave ends

  // Safety limit — never loop more than 30 days
  for (let i = 0; i < 30; i++) {
    if (!(await isNonWorkingDay(cursor))) {
      return cursor;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // Fallback (shouldn't happen)
  return cursor;
}

/**
 * Validates that both start and end dates fall on working days.
 * Returns an error message string if invalid, or null if valid.
 */
export async function validateLeaveDates(
  start: Date,
  end: Date,
): Promise<string | null> {
  if (isWeekend(start)) {
    return `Leave cannot start on a weekend (${start.toDateString()})`;
  }
  if (isWeekend(end)) {
    return `Leave cannot end on a weekend (${end.toDateString()})`;
  }

  const startKey = toDateKey(start);
  const endKey = toDateKey(end);
  const holidays = await getHolidayDates(start.getFullYear());

  if (holidays.has(startKey)) {
    return `Leave start date (${start.toDateString()}) is a public holiday`;
  }
  if (holidays.has(endKey)) {
    return `Leave end date (${end.toDateString()}) is a public holiday`;
  }

  return null;
}
