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

  it("should return 423 Locked when user has an active migration running", async () => {
    // Create an active batch for this user with required targetType
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
    expect(res.status).toBe(423);

    const body = await res.json();
    expect(body.error).toBe("MIGRATION_ACTIVE");
    expect(body.batchId).toBe(batch.id);
  });

  it("should allow forced logout with ?force=true and pause the active migration", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/logout?force=true", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testUserToken}`,
      },
    });

    const res = await postLogout(req);
    expect(res.status).toBe(200);

    // Verify batch status was changed to PAUSED
    const updatedBatch = await prisma.migrationBatch.findUnique({
      where: { id: activeBatchId! },
    });
    expect(updatedBatch?.status).toBe("PAUSED");
  });

  it("should allow logout without error when migration batch is PAUSED", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${testUserToken}`,
      },
    });

    const res = await postLogout(req);
    expect(res.status).toBe(200);
  });
});
