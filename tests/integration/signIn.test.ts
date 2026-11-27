import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  TEST_PASSWORD as PASSWORD,
  cookieHeaderFrom,
  createUserFactory,
  freshIp,
  signIn,
} from "../helpers/authUsers";

const HOUR = 60 * 60 * 1000;
const users = createUserFactory("si");
describe("Sesi Pengguna: sign-in through better-auth", () => {
  const previousTrustedProxy = process.env.TRUSTED_PROXY;

  beforeAll(() => {
    process.env.TRUSTED_PROXY = "true";
  });

  afterEach(async () => {
    const keys = await import("@/lib/redis").then(({ default: redis }) => redis.keys("lockout:*10.99.*"));
    if (keys.length > 0) {
      const { default: redis } = await import("@/lib/redis");
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    process.env.TRUSTED_PROXY = previousTrustedProxy;
    await users.cleanup();
  });

  it.each([
    [Role.PETUGAS_LAPANGAN, 7 * 24 * HOUR],
    [Role.PEGAWAI, 24 * HOUR],
  ])("gives a %s session a fixed lifetime from the PRD", async (role, lifetimeMs) => {
    const user = await users.createUser({ role });

    const before = Date.now();
    const { headers } = await signIn(user.username, PASSWORD, freshIp());
    const session = await auth.api.getSession({ headers: cookieHeaderFrom(headers) });

    const expiresAt = new Date(session!.session.expiresAt).getTime();
    expect(expiresAt - before).toBeGreaterThan(lifetimeMs - 60_000);
    expect(expiresAt - before).toBeLessThan(lifetimeMs + 60_000);
  });

  it("rejects a wrong password in Indonesian with the remaining attempts, and audits it", async () => {
    const user = await users.createUser();

    const error = await signIn(user.username, "wrong-password", freshIp()).catch((e) => e);

    expect(error).toMatchObject({
      statusCode: 401,
      body: { message: "Username atau kata sandi salah. Sisa percobaan: 4", remaining: 4, locked: false },
    });
    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: "AUTH_LOGIN_FAILED" },
    });
    expect(audit?.metadata).toMatchObject({ reason: "INVALID_PASSWORD", remaining: 4 });
  });

  it("locks the account after 5 failures, refusing even the correct password", async () => {
    const user = await users.createUser();
    const ip = freshIp();
    for (let i = 0; i < 4; i++) {
      await signIn(user.username, "wrong-password", ip).catch(() => undefined);
    }

    const fifth = await signIn(user.username, "wrong-password", ip).catch((e) => e);
    expect(fifth).toMatchObject({ statusCode: 429, body: { code: "LOGIN_LOCKED", locked: true } });

    const correct = await signIn(user.username, PASSWORD, ip).catch((e) => e);
    expect(correct).toMatchObject({ statusCode: 429, body: { code: "LOGIN_LOCKED" } });
    expect(correct.body.message).toMatch(/dikunci sementara selama 15 menit/);
  });

  it("rejects a deactivated user and audits the reason", async () => {
    const user = await users.createUser({ isActive: false });

    const error = await signIn(user.username, PASSWORD, freshIp()).catch((e) => e);

    expect(error).toMatchObject({ statusCode: 401, body: { code: "INVALID_CREDENTIALS" } });
    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: "AUTH_LOGIN_FAILED" },
    });
    expect(audit?.metadata).toMatchObject({ reason: "DEACTIVATED" });
  });

  it("audits a successful sign-in and clears earlier failures", async () => {
    const user = await users.createUser();
    const ip = freshIp();
    for (let i = 0; i < 4; i++) {
      await signIn(user.username, "wrong-password", ip).catch(() => undefined);
    }

    await signIn(user.username, PASSWORD, ip);

    const afterReset = await signIn(user.username, "wrong-password", ip).catch((e) => e);
    expect(afterReset.body.remaining).toBe(4);
    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: "AUTH_LOGIN_SUCCESS" },
    });
    expect(audit).not.toBeNull();
  });

  it("signs in a user whose username was stored with capital letters", async () => {
    const user = await users.createUser();
    const mixedCase = `Petugas_${user.username}`.slice(0, 32);
    await prisma.user.update({ where: { id: user.id }, data: { username: mixedCase } });

    await expect(signIn(mixedCase, PASSWORD, freshIp())).resolves.toBeDefined();
  });

  it("audits sign-out and ends the session", async () => {
    const user = await users.createUser();
    const { headers } = await signIn(user.username, PASSWORD, freshIp());
    const cookie = cookieHeaderFrom(headers);

    await auth.api.signOut({ headers: cookie });

    expect(await auth.api.getSession({ headers: cookie })).toBeNull();
    const audit = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: "AUTH_LOGOUT" },
    });
    expect(audit).not.toBeNull();
  });

  it("signs in with a legacy SHA-256 hash and upgrades it to bcrypt", async () => {
    const { createHash } = await import("crypto");
    const legacy = createHash("sha256").update(PASSWORD + "_goro_salt_2026").digest("hex");
    const user = await users.createUser({ passwordHash: legacy });

    await signIn(user.username, PASSWORD, freshIp());

    const account = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    expect(account?.password).toMatch(/^\$2[aby]\$/);
    await expect(signIn(user.username, PASSWORD, freshIp())).resolves.toBeDefined();
  });
});
