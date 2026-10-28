import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface CreateAuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface GetAuditLogsParams {
  userId?: string;
  action?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Persistently records a critical security or business action in the tamper-proof AuditLog.
 */
export async function logAuditEvent(params: CreateAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: params.metadata || undefined,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
    // Non-fatal fallback so main business transaction isn't broken if logging has transient error
    return null;
  }
}

/**
 * Retrieves audit log entries with optional filters for compliance & inspection.
 */
export async function getAuditLogs(params: GetAuditLogsParams = {}) {
  const { limit = 50, offset = 0, userId, action, entityType } = params;

  const where: Prisma.AuditLogWhereInput = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      take: Math.min(limit, 100),
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return { total, logs };
}
