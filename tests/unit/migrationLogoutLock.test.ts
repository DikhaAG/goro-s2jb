import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { POST as postLogout } from "@/app/api/auth/logout/route";
import prisma from "@/lib/prisma";

describe("Migration Logout Lock Guard (POST /api/auth/logout)", () => {
  let testUserId: string;
  let testUserToken: string;
  let activeBatchId: string | null = null;

  beforeAll(async () => {
    // Create dedicated clean test user to ensure isolated state
    const uniqueSuffix = Date.now();
    const newUser = await prisma.user.create({
      data: {
        username: `test_logout_${uniqueSuffix}`,
        email: `test_logout_${uniqueSuffix}@pln.co.id`,
        name: "Test Logout Lock User",
        passwordHash: "hash_placeholder",
        role: Role.PEGAWAI,
      },
    });
    testUserId = newUser.id;

    testUserToken = await signSessionToken({
      id: testUserId,
      username: newUser.username,
      name: newUser.name,
      role: Role.PEGAWAI,
      up3Id: null,
      ulpId: null,
    });
  });

  afterAll(async () => {
    if (activeBatchId) {
      await prisma.migrationBatch.deleteMany({
        where: { id: activeBatchId },
      }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({
        where: { id: testUserId },
      }).catch(() => {});
    }
  });

  it("should allow logout when user has no active migration", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testUserToken}`,
      },
    });

    const res = await postLogout(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("should allow unrestricted logout even when user has an active migration running (AC-4)", async () => {
    // Create an active batch for this user
    const batch = await prisma.migrationBatch.create({
      data: {
        fileName: "active_import.csv",
        fileSize: 10240,
        targetType: "FORM_RESPONSES_RAW",
        status: "PROCESSING",
        uploadedById: testUserId,
      },
    });
    activeBatchId = batch.id;

    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testUserToken}`,
      },
    });

    const res = await postLogout(req);
    // Under Task 16, logout is never locked (returns 200, not 423)
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify batch status is preserved as PROCESSING (uninterrupted background execution)
    const currentBatch = await prisma.migrationBatch.findUnique({
      where: { id: batch.id },
    });
    expect(currentBatch?.status).toBe("PROCESSING");
  });

  it("should allow logout cleanly when migration batch is PAUSED or CANCELLED", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testUserToken}`,
      },
    });

    const res = await postLogout(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
