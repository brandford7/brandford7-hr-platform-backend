import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../errors/notFound.error";
import { ConflictError } from "../errors/conflict.error";
import { writeAuditLog } from "../utils/audit.util";
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "../schemas/department.schemas";

const DEPT_SELECT = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  manager: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
  _count: {
    select: { employees: { where: { deletedAt: null, status: "ACTIVE" } } },
  },
} satisfies Prisma.DepartmentSelect;

export async function getAllDepartments() {
  return prisma.department.findMany({
    where: { deletedAt: null },
    select: DEPT_SELECT,
    orderBy: { name: "asc" },
  });
}

export async function getDepartmentById(id: string) {
  const dept = await prisma.department.findFirst({
    where: { id, deletedAt: null },
    select: DEPT_SELECT,
  });
  if (!dept) throw new NotFoundError("Department");
  return dept;
}

export async function createDepartment(
  input: CreateDepartmentInput,
  req: Request,
) {
  const existing = await prisma.department.findFirst({
    where: { name: input.name, deletedAt: null },
  });
  if (existing) throw new ConflictError("Department name already exists");

  const dept = await prisma.department.create({
    data: input,
    select: DEPT_SELECT,
  });
  await writeAuditLog({
    userId: req.user!.userId,
    action: "CREATE",
    resource: "departments",
    resourceId: dept.id,
    req,
  });
  return dept;
}

export async function updateDepartment(
  id: string,
  input: UpdateDepartmentInput,
  req: Request,
) {
  await getDepartmentById(id);
  const dept = await prisma.department.update({
    where: { id },
    data: input,
    select: DEPT_SELECT,
  });
  await writeAuditLog({
    userId: req.user!.userId,
    action: "UPDATE",
    resource: "departments",
    resourceId: id,
    req,
  });
  return dept;
}

export async function deleteDepartment(id: string, req: Request) {
  await getDepartmentById(id);
  await prisma.department.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAuditLog({
    userId: req.user!.userId,
    action: "DELETE",
    resource: "departments",
    resourceId: id,
    req,
  });
}
