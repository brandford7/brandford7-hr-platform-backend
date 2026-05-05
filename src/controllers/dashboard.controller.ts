import type { Request, Response } from "express";
import { getDashboardStats } from "../services/dashboard.service";
import { sendSuccess } from "../utils/response.util";

// GET /api/dashboard/stats
export async function getStats(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await getDashboardStats(), "Dashboard stats retrieved");
}
