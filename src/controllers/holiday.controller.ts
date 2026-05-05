import type { Request, Response } from "express";
import {
  getHolidaysByYear,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from "../services/holiday.service";
import { sendSuccess, sendCreated } from "../utils/response.util";
import { CreateHolidayInput, HolidayQuery, UpdateHolidayInput } from "../schemas/holiday.schema";
    

// GET /api/holidays?year=2025
export async function getAll(req: Request, res: Response): Promise<void> {
  const query = req.validated?.query as HolidayQuery;
  sendSuccess(res, await getHolidaysByYear(query), "Holidays retrieved");
}

// POST /api/holidays
export async function create(req: Request, res: Response): Promise<void> {
  sendCreated(
    res,
    await createHoliday(req.body as CreateHolidayInput, req),
    "Holiday created",
  );
}

// PATCH /api/holidays/:id
export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.validated?.params ?? req.params;
  sendSuccess(
    res,
    await updateHoliday(id! as string, req.body as UpdateHolidayInput, req),
    "Holiday updated",
  );
}

// DELETE /api/holidays/:id
export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.validated?.params ?? req.params;
  await deleteHoliday(id! as string, req);
  sendSuccess(res, null, "Holiday deleted");
}
