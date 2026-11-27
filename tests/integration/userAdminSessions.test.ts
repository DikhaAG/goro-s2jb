import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { appRouter } from "@/server/routers/_app";
import { session } from "@/server/session/live";
import {
  TEST_PASSWORD,
  createUserFactory,
  sessionCookieFor,
  signIn,
} from "../helpers/authUsers";

const users = createUserFactory("ua");

function callerFor(user: { id: string; username: string; name: string; role: Role }, cookie?: Headers) {
  return appRouter.createCaller({
    prisma,
    redis,
    user: { ...user, up3Id: null, ulpId: null },
    ipAddress: undefined,
    userAgent: "vitest",
    req: cookie ? new Request("http://localhost:3000/api/trpc", { headers: cookie }) : undefined,
  });
}

describe("Super Admin user management ends Sesi Pengguna", () => {
  const previousTrustedProxy = process.env.TRUSTED_PROXY;
  let admin: Awaited<ReturnType<typeof users.createUser>>;

  beforeAll(async () => {
    process.env.TRUSTED_PROXY = "true";
    admin = await users.createUser({ role: Role.SUPER_ADMIN });
  });

  afterAll(async () => {
    process.env.TRUSTED_PROXY = previousTrustedProxy;
    await prisma.user.deleteMany({ where: { username: { startsWith: "ua_new_" } } });
    await users.cleanup();
  });

  it("ends every session when a user is deactivated", async () => {
    const target = await users.createUser();
    const cookie = await sessionCookieFor(target.username);

    await callerFor(admin).user.toggleStatus({ id: target.id, isActive: false });

    await prisma.user.update({ where: { id: target.id }, data: { isActive: true } });
    expect(await session.getUser(cookie)).toBeNull();
  });

  it("ends every session when a user is deactivated through updateUser", async () => {
    const target = await users.createUser({ role: Role.PEGAWAI });
    const cookie = await sessionCookieFor(target.username);

    await callerFor(admin).user.updateUser({
      id: target.id,
      name: target.name,
      role: Role.PEGAWAI,
      isActive: false,
    });

    await prisma.user.update({ where: { id: target.id }, data: { isActive: true } });
    expect(await session.getUser(cookie)).toBeNull();
  });

  it("resets a password, ends every session, and the new password signs in", async () => {
    const target = await users.createUser();
    const cookie = await sessionCookieFor(target.username);

    const result = await callerFor(admin).user.resetPassword({ id: target.id, newPassword: "N3w-Passw0rd!" });

    expect(result.temporaryPassword).toBe("N3w-Passw0rd!");
    expect(await session.getUser(cookie)).toBeNull();
    await expect(signIn(target.username, "N3w-Passw0rd!")).resolves.toBeDefined();
    await expect(signIn(target.username, TEST_PASSWORD)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("generates a random temporary password instead of a fixed one", async () => {
    const target = await users.createUser();

    const first = await callerFor(admin).user.resetPassword({ id: target.id });
    const second = await callerFor(admin).user.resetPassword({ id: target.id });

    expect(first.temporaryPassword).not.toBe("PLN_2026_Temp!");
    expect(first.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(second.temporaryPassword).not.toBe(first.temporaryPassword);
    await expect(signIn(target.username, second.temporaryPassword)).resolves.toBeDefined();
  });

  it("creates a user who can sign in with the given password", async () => {
    const username = `ua_new_${Date.now() % 1_000_000}`;

    await callerFor(admin).user.createUser({
      username,
      name: "Pegawai Baru",
      password: "Fresh-Passw0rd!",
      role: Role.PEGAWAI,
    });

    await expect(signIn(username, "Fresh-Passw0rd!")).resolves.toBeDefined();
  });

  it("changes one's own password, keeping this session and ending the others", async () => {
    const me = await users.createUser({ role: Role.PEGAWAI });
    const thisDevice = await sessionCookieFor(me.username);
    const otherDevice = await sessionCookieFor(me.username);

    await callerFor(me, thisDevice).auth.changePassword({
      currentPassword: TEST_PASSWORD,
      newPassword: "Chang3d-Passw0rd!",
    });

    expect(await session.getUser(otherDevice)).toBeNull();
    await expect(signIn(me.username, "Chang3d-Passw0rd!")).resolves.toBeDefined();
  });

  it("rejects changing one's password with the wrong current password", async () => {
    const me = await users.createUser({ role: Role.PEGAWAI });
    const cookie = await sessionCookieFor(me.username);

    await expect(
      callerFor(me, cookie).auth.changePassword({ currentPassword: "wrong", newPassword: "Whatever-123!" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Password saat ini salah." });
  });
});
