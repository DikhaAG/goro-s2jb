import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { MigrationStatus, Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createUserFactory, sessionCookieFor } from "../helpers/authUsers";

const users = createUserFactory("ml");

// Batch Migrasi runs in the BullMQ worker, so signing out must never wait for it (AC-4).
describe("Sign-out is never blocked by a Batch Migrasi", () => {
  let uploader: Awaited<ReturnType<typeof users.createUser>>;
  const batchIds: string[] = [];

  beforeAll(async () => {
    uploader = await users.createUser({ role: Role.PEGAWAI });
  });

  afterEach(async () => {
    await prisma.migrationBatch.deleteMany({ where: { id: { in: batchIds.splice(0) } } });
  });

  afterAll(async () => {
    await users.cleanup();
  });

  it.each([null, "PROCESSING", "PAUSED", "CANCELLED"] as const)(
    "signs out with batch status %s",
    async (status) => {
      if (status) {
        const batch = await prisma.migrationBatch.create({
          data: {
            fileName: "active_import.csv",
            fileSize: 10240,
            targetType: "FORM_RESPONSES_RAW",
            status: status as MigrationStatus,
            uploadedById: uploader.id,
          },
        });
        batchIds.push(batch.id);
      }
      const cookie = await sessionCookieFor(uploader.username);

      await expect(auth.api.signOut({ headers: cookie })).resolves.toMatchObject({ success: true });
      expect(await auth.api.getSession({ headers: cookie })).toBeNull();
    }
  );
});
