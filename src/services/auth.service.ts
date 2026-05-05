import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Request } from "express";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.util";

import { writeAuditLog } from "../utils/audit.util";
import type {
  LoginInput,
  ChangePasswordInput,
  SetInitialPasswordInput,
} from "../schemas/auth.schemas";
import { UnauthorizedError } from "../errors/unAuthorized.error";
import { NotFoundError } from "../errors/notFound.error";
import { AppError } from "../errors/app.error";

const SALT_ROUNDS = 12;

// Role → RoleDuties → Duties → DutyPrivileges → Privileges
// Returns a flat array of privilege name strings for the JWT payload
async function resolvePrivilegesForRole(roleId: string): Promise<string[]> {
  const roleDuties = await prisma.roleDuty.findMany({
    where: { roleId },
    include: {
      duty: {
        include: {
          dutyPrivileges: {
            include: { privilege: true },
          },
        },
      },
    },
  });

  // Flatten and deduplicate
  const privilegeSet = new Set<string>();
  for (const rd of roleDuties) {
    for (const dp of rd.duty.dutyPrivileges) {
      privilegeSet.add(dp.privilege.name);
    }
  }

  return Array.from(privilegeSet);
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue a new access + refresh token pair.
// Stores a hashed refresh token in DB for rotation and reuse detection.
// ─────────────────────────────────────────────────────────────────────────────
async function issueTokenPair(
  userId: string,
  employeeId: string | null,
  role: { id: string; name: string },
  privileges: string[],
  mustChangePassword: boolean,
) {
  const tokenId = crypto.randomUUID();
  const refreshToken = generateRefreshToken({ userId, tokenId });
  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { id: tokenId, userId, tokenHash, expiresAt },
  });

  const accessToken = generateAccessToken({
    userId,
    employeeId,
    roleId: role.id,
    roleName: role.name,
    privileges,
    mustChangePassword
  });

  return { accessToken, refreshToken };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// Returns mustChangePassword so the frontend can gate access
// ─────────────────────────────────────────────────────────────────────────────
/*export async function loginUser(input: LoginInput, req: Request) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { role: true, employee: true },
  });

  if (!user || !user.isActive)
    throw new UnauthorizedError("Invalid email or password");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid email or password");

  const privileges = await resolvePrivilegesForRole(user.roleId);
  const tokens = await issueTokenPair(
    user.id,
    user.employee?.id ?? null,
    user.role,
    privileges,
    user.mustChangePassword,
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLog({
    userId: user.id,
    action: "LOGIN",
    resource: "users",
    resourceId: user.id,
    req,
  });

  logger.info({ userId: user.id, email: user.email }, "User logged in");

  return {
    ...tokens,
    mustChangePassword: user.mustChangePassword,
    user: {
      id: user.id,
      email: user.email,
      roleName: user.role.name,
      roleDisplayName: user.role.displayName,
      employeeId: user.employee?.id ?? null,
      firstName: user.employee?.firstName ?? null,
      lastName: user.employee?.lastName ?? null,
    },
  };
}
*/

export async function loginUser(input: LoginInput, req: Request) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: {
      role: true,
      employee: {
        include: {
          jobPosition: true, // Fetch the title from the related table
        },
      },
    },
  });

  if (!user || !user.isActive)
    throw new UnauthorizedError("Invalid email or password");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid email or password");

  const privileges = await resolvePrivilegesForRole(user.roleId);
  const tokens = await issueTokenPair(
    user.id,
    user.employee?.id ?? null,
    user.role,
    privileges,
    user.mustChangePassword,
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLog({
    userId: user.id,
    action: "LOGIN",
    resource: "users",
    resourceId: user.id,
    req,
  });

  logger.info({ userId: user.id, email: user.email }, "User logged in");

  return {
    ...tokens,
    mustChangePassword: user.mustChangePassword,
    user: {
      id: user.id,
      email: user.email,
      roleName: user.role.name,
      roleDisplayName: user.role.displayName,
      employeeId: user.employee?.id ?? null,
      firstName: user.employee?.firstName ?? null,
      lastName: user.employee?.lastName ?? null,
      jobPosition: user.employee?.jobPosition?.title ?? null, // Added this line
    },
  };
}

// FORCE CHANGE PASSWORD (first-login)
// Clears mustChangePassword, stamps passwordChangedAt, issues fresh tokens

/*
export async function forceChangePassword(
  userId: string,
  input: SetInitialPasswordInput,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, employee: true },
  });
  if (!user) throw new NotFoundError("User");
  if (!user.mustChangePassword) {
    throw new AppError(
      "Password has already been set. Use change-password instead.",
      400,
    );
  }

  const newHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
    // Revoke all previous refresh tokens — clean slate
    prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    userId,
    action: "PASSWORD_CHANGE",
    resource: "users",
    resourceId: userId,
    newValues: { type: "initial_set" },
  });

  // Issue fresh tokens with mustChangePassword now false
  const privileges = await resolvePrivilegesForRole(user.roleId);
  const tokens = await issueTokenPair(
    userId,
    user.employee?.id ?? null,
    user.role,
    privileges,
    false
  );

  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      roleName: user.role.name,
      roleDisplayName: user.role.displayName,
      employeeId: user.employee?.id ?? null,
      firstName: user.employee?.firstName ?? null,
      lastName: user.employee?.lastName ?? null,
    },
  };
}
  */

export async function forceChangePassword(
  userId: string,
  input: SetInitialPasswordInput,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      employee: {
        include: { jobPosition: true },
      },
    },
  });

  if (!user) throw new NotFoundError("User");
  if (!user.mustChangePassword) {
    throw new AppError(
      "Password has already been set. Use change-password instead.",
      400,
    );
  }

  const newHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    userId,
    action: "PASSWORD_CHANGE",
    resource: "users",
    resourceId: userId,
    newValues: { type: "initial_set" },
  });

  const privileges = await resolvePrivilegesForRole(user.roleId);
  const tokens = await issueTokenPair(
    userId,
    user.employee?.id ?? null,
    user.role,
    privileges,
    false,
  );

  return {
    ...tokens,
    mustChangePassword: false,
    user: {
      id: user.id,
      email: user.email,
      roleName: user.role.name,
      roleDisplayName: user.role.displayName,
      employeeId: user.employee?.id ?? null,
      firstName: user.employee?.firstName ?? null,
      lastName: user.employee?.lastName ?? null,
      jobPosition: user.employee?.jobPosition?.title ?? null, // Added this line
    },
  };
}

// REFRESH TOKENS — rotation with reuse detection
export async function refreshUserTokens(rawRefreshToken: string) {
  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawRefreshToken)
    .digest("hex");

  const stored = await prisma.refreshToken.findFirst({
    where: { id: payload.tokenId, userId: payload.userId, revokedAt: null },
  });

  if (
    !stored ||
    stored.tokenHash !== tokenHash ||
    stored.expiresAt < new Date()
  ) {
    // Possible reuse attack — revoke ALL tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId: payload.userId },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError("Token reuse detected. Please log in again.");
  }

  // Rotate: revoke consumed token
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { role: true, employee: true },
  });
  if (!user || !user.isActive)
    throw new UnauthorizedError("Account is inactive");

  const privileges = await resolvePrivilegesForRole(user.roleId);
  return issueTokenPair(
    user.id,
    user.employee?.id ?? null,
    user.role,
    privileges,
    user.mustChangePassword,
  );
}

// LOGOUT
export async function logoutUser(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await writeAuditLog({
    userId,
    action: "LOGOUT",
    resource: "users",
    resourceId: userId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VOLUNTARY CHANGE PASSWORD (any authenticated user)
// ─────────────────────────────────────────────────────────────────────────────
export async function changeUserPassword(
  userId: string,
  input: ChangePasswordInput,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User");

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw new AppError("Current password is incorrect", 400);

  const newHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, passwordChangedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    userId,
    action: "PASSWORD_CHANGE",
    resource: "users",
    resourceId: userId,
    newValues: { type: "voluntary_change" },
  });
}
