import type { Request, Response } from "express";
import {
  getAllRoles,
  getAllDuties,
  getAllPrivileges,
  assignDutiesToRole,
  removeDutyFromRole,
  createPrivilege,
  createDuty,
  updateDuty,
  createRole,
} from "../services/security.service";
import { sendSuccess, sendCreated } from "../utils/response.util";

export async function getRoles(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await getAllRoles());
}
export async function getDuties(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await getAllDuties());
}
export async function getPrivileges(
  _req: Request,
  res: Response,
): Promise<void> {
  sendSuccess(res, await getAllPrivileges());
}

export async function createRoleHandler(
  req: Request,
  res: Response,
): Promise<void> {
  sendCreated(res, await createRole(req.body), "Role created");
}

export async function assignDuties(req: Request, res: Response): Promise<void> {
  const { id } = req.validated?.params ?? req.params;
  const { dutyIds } = req.body as { dutyIds: string[] };
  await assignDutiesToRole(id! as string, dutyIds);
  sendSuccess(res, null, "Duties assigned successfully");
}

export async function removeDuty(req: Request, res: Response): Promise<void> {
  await removeDutyFromRole(req.params["id"]! as string, req.params["dutyId"]! as string);
  sendSuccess(res, null, "Duty removed");
}

export async function createDutyHandler(
  req: Request,
  res: Response,
): Promise<void> {
  sendCreated(res, await createDuty(req.body), "Duty created");
}

export async function updateDutyHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.validated?.params ?? req.params;
  sendSuccess(res, await updateDuty(id! as string, req.body), "Duty updated");
}

export async function createPrivilegeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  sendCreated(res, await createPrivilege(req.body), "Privilege created");
}
