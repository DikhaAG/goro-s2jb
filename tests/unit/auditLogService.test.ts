import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAuditEvent, getAuditLogs } from "@/server/services/auditService";
import prisma from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  default: {
    auditLog: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("AuditLog Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully creates a security audit event with metadata", async () => {
    const mockCreated = {
      id: "audit-1",
      userId: "user-1",
      action: "AUTH_LOGIN_SUCCESS",
      entityType: "User",
      entityId: "user-1",
      ipAddress: "127.0.0.1",
      userAgent: "Vitest/1.0",
      metadata: { role: "SUPER_ADMIN" },
      createdAt: new Date(),
    };

    (prisma.auditLog.create as any).mockResolvedValue(mockCreated);

    const result = await logAuditEvent({
      userId: "user-1",
      action: "AUTH_LOGIN_SUCCESS",
      entityType: "User",
      entityId: "user-1",
      ipAddress: "127.0.0.1",
      userAgent: "Vitest/1.0",
      metadata: { role: "SUPER_ADMIN" },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "AUTH_LOGIN_SUCCESS",
        entityType: "User",
        entityId: "user-1",
        ipAddress: "127.0.0.1",
        userAgent: "Vitest/1.0",
        metadata: { role: "SUPER_ADMIN" },
      },
    });
    expect(result).toEqual(mockCreated);
  });

  it("retrieves paginated audit logs with action filters", async () => {
    const mockLogs = [
      {
        id: "audit-1",
        action: "USER_CREATE",
        entityType: "User",
        createdAt: new Date(),
        user: { name: "Admin", username: "superadmin" },
      },
    ];

    (prisma.auditLog.count as any).mockResolvedValue(1);
    (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);

    const result = await getAuditLogs({
      action: "USER_CREATE",
      limit: 10,
      offset: 0,
    });

    expect(prisma.auditLog.count).toHaveBeenCalledWith({
      where: { action: "USER_CREATE" },
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { action: "USER_CREATE" },
      take: 10,
      skip: 0,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          },
        },
      },
    });
    expect(result).toEqual({ total: 1, logs: mockLogs });
  });
});
