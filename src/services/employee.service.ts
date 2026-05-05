import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../errors/notFound.error";
import { ConflictError } from "../errors/conflict.error";
import { writeAuditLog } from "../utils/audit.util";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeQuery,
} from "../schemas/employee.schemas";

const EMPLOYEE_SELECT = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  middleName: true,
  phone: true,
  gender: true,
  dateOfBirth: true,
  address: true,
  city: true,
  country: true,
  avatarUrl: true,
  employmentType: true,
  status: true,
  salary: true,
  hireDate: true,
  terminationDate: true,
  emergencyContact: true,
  bio: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      email: true,
      role: { select: { id: true, name: true, displayName: true } },
    },
  },
  department: { select: { id: true, name: true } },
  jobPosition: { select: { id: true, title: true } },
} satisfies Prisma.EmployeeSelect;

export async function getAllEmployees(query: EmployeeQuery) {
  const {
    page,
    limit,
    search,
    departmentId,
    status,
    employmentType,
    sortBy,
    sortOrder,
  } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.EmployeeWhereInput = {
    deletedAt: null,
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ],
    }),
    ...(departmentId && { departmentId }),
    ...(status && { status }),
    ...(employmentType && { employmentType }),
  };

  const [employees, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      select: EMPLOYEE_SELECT,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);

  return { employees, total, page, limit };
}

export async function getEmployeeById(id: string) {
  const employee = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    select: EMPLOYEE_SELECT,
  });
  if (!employee) throw new NotFoundError("Employee");
  return employee;
}

export async function getEmployeeByUserId(userId: string) {
  const employee = await prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: EMPLOYEE_SELECT,
  });
  if (!employee) throw new NotFoundError("Employee");
  return employee;
}

export async function createEmployee(input: CreateEmployeeInput, req: Request) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing)
    throw new ConflictError("An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, 12);

  const employee = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, passwordHash, roleId: input.roleId },
    });

    const count = await tx.employee.count();
    const employeeCode = `EMP-${String(count + 1).padStart(4, "0")}`;

    return tx.employee.create({
      data: {
        userId: user.id,
        employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName,
        phone: input.phone,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth
          ? new Date(input.dateOfBirth)
          : undefined,
        address: input.address,
        city: input.city,
        country: input.country,
        departmentId: input.departmentId,
        jobPositionId: input.jobPositionId,
        employmentType: input.employmentType,
        salary: input.salary,
        hireDate: new Date(input.hireDate),
        bio: input.bio,
        emergencyContact: input.emergencyContact,
      },
      select: EMPLOYEE_SELECT,
    });
  });

  await writeAuditLog({
    userId: req.user!.userId,
    action: "CREATE",
    resource: "employees",
    resourceId: employee.id,
    newValues: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
    },
    req,
  });

  return employee;
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
  req: Request,
) {
  const existing = await getEmployeeById(id);

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      ...input,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      hireDate: input.hireDate ? new Date(input.hireDate) : undefined,
      salary: input.salary ?? undefined,
    },
    select: EMPLOYEE_SELECT,
  });

  await writeAuditLog({
    userId: req.user!.userId,
    action: "UPDATE",
    resource: "employees",
    resourceId: id,
    oldValues: existing as Record<string, unknown>,
    newValues: input as Record<string, unknown>,
    req,
  });

  return updated;
}

export async function deleteEmployee(id: string, req: Request) {
  await getEmployeeById(id); // throws NotFoundError if missing

  await prisma.employee.update({
    where: { id },
    data: { deletedAt: new Date(), status: "TERMINATED" },
  });

  await writeAuditLog({
    userId: req.user!.userId,
    action: "DELETE",
    resource: "employees",
    resourceId: id,
    req,
  });
}
