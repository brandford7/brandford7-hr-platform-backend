import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.util";
import { UnauthorizedError } from "../errors/unAuthorized.error";
import { ForbiddenError } from "../errors/forbidden.error";

// authenticate
// It verifies the Bearer access token and attaches decoded payload to req.user.
// Does NOT block users who still mustChangePassword — that is a separate guard.
// ─────────────────────────────────────────────────────────────────────────────
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  try {
    const token = authHeader.slice(7);
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// requirePasswordChanged
// Blocks access if the user hasn't completed their first-login password set.
// Must be used AFTER authenticate.
// ─────────────────────────────────────────────────────────────────────────────
export function requirePasswordChanged(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) throw new UnauthorizedError();

  if (req.user.mustChangePassword) {
    throw new ForbiddenError(
      "You must set a new password before accessing this resource.",
    );
  }

  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// requirePrivilege
// AX 2012-style check: does the user's flat privilege set contain
// at least one of the required privilege names?
//
// Usage:
//   router.delete('/:id', authenticate, requirePasswordChanged,
//                         requirePrivilege('EmployeeDelete'), controller.remove)
// ─────────────────────────────────────────────────────────────────────────────
export function requirePrivilege(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();

    const has = required.some((p) => req.user!.privileges.includes(p));
    if (!has) {
      throw new ForbiddenError(
        `Access denied. Required privilege: ${required.join(" or ")}`,
      );
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requireRole
// Broad role-name gate. Use requirePrivilege for fine-grained access.
// ─────────────────────────────────────────────────────────────────────────────
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();

    if (!roles.includes(req.user.roleName)) {
      throw new ForbiddenError("Access denied. Insufficient role.");
    }

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requireOwnerOrPrivilege
// Passes if the requesting user owns the resource OR has the given privilege.
// Used for "view own profile" OR "admin can view any profile".
// ─────────────────────────────────────────────────────────────────────────────
export function requireOwnerOrPrivilege(
  getOwnerId: (req: Request) => string,
  privilege: string,
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();

    const ownerId = getOwnerId(req);
    const isOwner =
      req.user.employeeId === ownerId || req.user.userId === ownerId;
    const hasPrivilege = req.user.privileges.includes(privilege);

    if (!isOwner && !hasPrivilege) throw new ForbiddenError("Access denied");

    next();
  };
}
