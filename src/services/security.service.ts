import { prisma } from "../config/prisma";
import { ConflictError } from "../errors/conflict.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/notFound.error";


export type PrivilegeRecord = {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
};

export type DutyWithPrivileges = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  privileges: PrivilegeRecord[];
};

export type RoleWithDuties = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  duties: DutyWithPrivileges[];
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Shared Prisma select for fetching a duty and its privileges. */
const DUTY_SELECT = {
  id: true,
  name: true,
  displayName: true,
  description: true,
  isSystem: true,
  dutyPrivileges: {
    select: {
      privilege: {
        select: {
          id: true,
          name: true,
          resource: true,
          action: true,
          description: true,
          isSystem: true,
          createdAt: true,
        },
      },
    },
  },
} as const;

function shapeDuty(d: {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  dutyPrivileges: Array<{ privilege: PrivilegeRecord }>;
}): DutyWithPrivileges {
  return {
    id: d.id,
    name: d.name,
    displayName: d.displayName,
    description: d.description,
    isSystem: d.isSystem,
    privileges: d.dutyPrivileges.map((dp) => dp.privilege),
  };
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Returns all roles with their assigned duties and privileges.
 * Used for both the security management page and the role dropdown.
 * For ADMIN role, duties are listed as-is — the full privilege grant
 * is handled at the auth service level (not in the DB).
 */
export async function getAllRoles(): Promise<RoleWithDuties[]> {
  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      displayName: true,
      description: true,
      isSystem: true,
      roleDuties: {
        select: { duty: { select: DUTY_SELECT } },
      },
    },
  });

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    displayName: r.displayName,
    description: r.description,
    isSystem: r.isSystem,
    duties: r.roleDuties.map((rd) => shapeDuty(rd.duty)),
  }));
}

/**
 * Returns all duties with their full privilege lists.
 * Used to populate the duty assignment dialog on the security page.
 */
export async function getAllDuties(): Promise<DutyWithPrivileges[]> {
  const duties = await prisma.duty.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: DUTY_SELECT,
  });

  return duties.map(shapeDuty);
}

/**
 * Returns all privileges grouped by resource.
 * Used for the privilege viewer on the security page.
 */
export async function getAllPrivileges(): Promise<PrivilegeRecord[]> {
  return prisma.privilege.findMany({
    orderBy: [{ resource: "asc" }, { action: "asc" }],
    select: {
      id: true,
      name: true,
      resource: true,
      action: true,
      description: true,
      isSystem: true,
      createdAt: true,
    },
  });
}

/**
 * Atomically replaces all duties assigned to a role.
 * The ADMIN role is immutable — it always has all privileges implicitly.
 */
export async function assignDutiesToRole(
  roleId: string,
  dutyIds: string[],
): Promise<void> {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundError("Role");

  if (role.name === "ADMIN") {
    throw new ForbiddenError(
      "The Admin role has all privileges by default and cannot be modified.",
    );
  }

  // Validate all duty IDs exist before mutating
  const duties = await prisma.duty.findMany({
    where: { id: { in: dutyIds } },
    select: { id: true },
  });

  if (duties.length !== dutyIds.length) {
    const foundIds = new Set(duties.map((d) => d.id));
    const missing = dutyIds.filter((id) => !foundIds.has(id));
    throw new NotFoundError(`Duties not found: ${missing.join(", ")}`);
  }

  // Replace in a single transaction — no partial state
  await prisma.$transaction([
    prisma.roleDuty.deleteMany({ where: { roleId } }),
    prisma.roleDuty.createMany({
      data: dutyIds.map((dutyId) => ({ roleId, dutyId })),
      skipDuplicates: true,
    }),
  ]);
}

/**
 * Removes a single duty from a role.
 */
export async function removeDutyFromRole(
  roleId: string,
  dutyId: string,
): Promise<void> {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundError("Role");

  if (role.name === "ADMIN") {
    throw new ForbiddenError("The Admin role cannot be modified.");
  }

  // Silently succeeds if the duty was not assigned — idempotent
  await prisma.roleDuty.deleteMany({ where: { roleId, dutyId } });
}

// ── Create / Update operations ────────────────────────────────────────────────

export async function createPrivilege(input: {
  name: string;
  resource: string;
  action: string;
  description?: string;
}): Promise<PrivilegeRecord> {
  const existing = await prisma.privilege.findUnique({
    where: { name: input.name },
  });
  if (existing) {
    throw new ConflictError(
      `Privilege "${input.name}" already exists`,
    );
  }
  return prisma.privilege.create({ data: { ...input, isSystem: false } });
}

export async function createDuty(input: {
  name: string;
  displayName: string;
  description?: string;
  privilegeIds: string[];
}): Promise<DutyWithPrivileges> {
  const existing = await prisma.duty.findUnique({
    where: { name: input.name },
  });
  if (existing) throw new ConflictError(`Duty "${input.name}" already exists`);

  const duty = await prisma.$transaction(async (tx) => {
    const created = await tx.duty.create({
      data: {
        name: input.name,
        displayName: input.displayName,
        description: input.description,
        isSystem: false,
      },
    });
    if (input.privilegeIds.length > 0) {
      await tx.dutyPrivilege.createMany({
        data: input.privilegeIds.map((privilegeId) => ({
          dutyId: created.id,
          privilegeId,
        })),
        skipDuplicates: true,
      });
    }
    return created;
  });

  const full = await prisma.duty.findUniqueOrThrow({
    where: { id: duty.id },
    select: DUTY_SELECT,
  });
  return shapeDuty(full);
}

export async function updateDuty(
  id: string,
  input: {
    displayName?: string;
    description?: string;
    privilegeIds?: string[];
  },
): Promise<DutyWithPrivileges> {
  const existing = await prisma.duty.findUnique({ where: { id } });
  if (!existing)
    throw new NotFoundError(
      "Duty",
    );

  await prisma.$transaction(async (tx) => {
    await tx.duty.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined && {
          displayName: input.displayName,
        }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
      },
    });

    if (input.privilegeIds !== undefined) {
      await tx.dutyPrivilege.deleteMany({ where: { dutyId: id } });
      if (input.privilegeIds.length > 0) {
        await tx.dutyPrivilege.createMany({
          data: input.privilegeIds.map((privilegeId) => ({
            dutyId: id,
            privilegeId,
          })),
          skipDuplicates: true,
        });
      }
    }
  });

  const full = await prisma.duty.findUniqueOrThrow({
    where: { id },
    select: DUTY_SELECT,
  });
  return shapeDuty(full);
}

export async function createRole(input: {
  name: string;
  displayName: string;
  description?: string;
}): Promise<RoleWithDuties> {
  const existing = await prisma.role.findUnique({
    where: { name: input.name.toUpperCase() },
  });
  if (existing) throw new ConflictError(`Role "${input.name}" already exists`);

  const role = await prisma.role.create({
    data: {
      name: input.name.toUpperCase(),
      displayName: input.displayName,
      description: input.description,
      isSystem: false,
    },
  });

  return { ...role, duties: [] };
}
