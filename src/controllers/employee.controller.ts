import type { Request, Response } from "express";
import {
  getAllEmployees,
  getEmployeeById,
  getEmployeeByUserId,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../services/employee.service";
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
} from "../utils/response.util";
import type { EmployeeQuery } from "../schemas/employee.schemas";

// GET /api/employees
export async function getAll(req: Request, res: Response): Promise<void> {
  const query = req.validated?.query as EmployeeQuery;
  const { employees, total, page, limit } = await getAllEmployees(query);
  sendPaginated(res, employees, total, page, limit, "Employees retrieved");
}

// GET /api/employees/me
export async function getMe(req: Request, res: Response): Promise<void> {
  sendSuccess(
    res,
    await getEmployeeByUserId(req.user!.userId),
    "Profile retrieved",
  );
}

// GET /api/employees/:id
export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.validated?.params ?? req.params;
  sendSuccess(res, await getEmployeeById(id! as string), "Employee retrieved");
}

// POST /api/employees
export async function create(req: Request, res: Response): Promise<void> {
  sendCreated(
    res,
    await createEmployee(req.body, req),
    "Employee created successfully",
  );
}

// PATCH /api/employees/:id
export async function update(req: Request, res: Response): Promise<void> {
  const { id } = req.validated?.params ?? req.params;
  sendSuccess(
    res,
    await updateEmployee(id! as string, req.body, req),
    "Employee updated",
  );
}

// DELETE /api/employees/:id
export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = req.validated?.params ?? req.params;
  await deleteEmployee(id! as string, req);
  sendSuccess(res, null, "Employee deleted");
}
