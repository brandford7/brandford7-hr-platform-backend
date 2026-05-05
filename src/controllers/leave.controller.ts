import type { Request, Response } from "express";
import {
  getAllLeaveRequests,
  getLeaveRequestById,
  createLeaveRequest,
  reviewLeaveRequest,
  bulkReviewLeaveRequests,
  cancelLeaveRequest,
  getMyLeaveBalances,
} from "../services/leave.service";
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
} from "../utils/response.util";
import type { LeaveQuery } from "../schemas/leave.schemas";

// GET /api/leave
export async function getAll(req: Request, res: Response): Promise<void> {
  const { requests, total, page, limit } = await getAllLeaveRequests(
    req.query as unknown as LeaveQuery,
    req.user!,
  );
  sendPaginated(res, requests, total, page, limit, "Leave requests retrieved");
}

// GET /api/leave/balances
export async function getBalances(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await getMyLeaveBalances(req), "Leave balances retrieved");
}

// GET /api/leave/:id
export async function getById(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await getLeaveRequestById(req.params.id! as string));
}

// POST /api/leave
export async function create(req: Request, res: Response): Promise<void> {
  sendCreated(
    res,
    await createLeaveRequest(req.body, req),
    "Leave request submitted",
  );
}

// PATCH /api/leave/bulk-review
export async function bulkReview(req: Request, res: Response): Promise<void> {
  const result = await bulkReviewLeaveRequests(req.body, req);
  sendSuccess(
    res,
    result,
    `${result.succeeded} of ${result.total} requests processed`,
  );
}

// PATCH /api/leave/:id/review
export async function review(req: Request, res: Response): Promise<void> {
  const result = await reviewLeaveRequest(req.params.id! as string, req.body, req);
  sendSuccess(
    res,
    result,
    `Leave request ${(req.body.status as string).toLowerCase()}`,
  );
}

// PATCH /api/leave/:id/cancel
export async function cancel(req: Request, res: Response): Promise<void> {
  await cancelLeaveRequest(req.params.id! as string, req);
  sendSuccess(res, null, "Leave request cancelled");
}
