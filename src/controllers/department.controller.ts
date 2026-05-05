import type { Request, Response } from "express";
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../services/department.service";
import { sendSuccess, sendCreated } from "../utils/response.util";

// GET /api/departments
export async function getAll(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await getAllDepartments());
}

// GET /api/departments/:id
export async function getById(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await getDepartmentById(req.params.id! as string));
}

// POST /api/departments
export async function create(req: Request, res: Response): Promise<void> {
  sendCreated(res, await createDepartment(req.body, req), "Department created");
}

// PATCH /api/departments/:id
export async function update(req: Request, res: Response): Promise<void> {
  sendSuccess(
    res,
    await updateDepartment(req.params.id! as string, req.body, req),
    "Department updated",
  );
}

// DELETE /api/departments/:id
export async function remove(req: Request, res: Response): Promise<void> {
  await deleteDepartment(req.params.id! as string, req);
  sendSuccess(res, null, "Department deleted");
}
