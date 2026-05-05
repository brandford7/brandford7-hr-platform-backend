import type { AuditAction } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";

interface AuditOptions {
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  req?: Request;
}

// Write an audit log entry. Fails silently to never break the main flow.
export const writeAuditLog = async (options: AuditOptions): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: options.userId,
        action: options.action,
        resource: options.resource,
        resourceId: options.resourceId,
        oldValues: options.oldValues as never,
        newValues: options.newValues as never,
        ipAddress: options.req?.ip,
        userAgent: options.req?.headers["user-agent"],
      },
    });
  } catch (error) {
    // Never throw — audit failures must not break the main operation
    logger.error({ error, options }, "Failed to write audit log");
  }
};
