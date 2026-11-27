import { describe, it, expect, afterAll } from "vitest";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { session } from "@/server/session/live";
import { createUserFactory, sessionCookieFor } from "../helpers/authUsers";

const users = createUserFactory("sl");

describe("Sesi Pengguna over better-auth", () => {
  const previousTrustedProxy = process.env.TRUSTED_PROXY;
  process.env.TRUSTED_PROXY = "true";

  afterAll(async () => {
    process.env.TRUSTED_PROXY = previousTrustedProxy;
    await users.cleanup();
  });

  it("resolves the signed-in user from the session cookie", async () => {
    const user = await users.createUser({ role: Role.PEGAWAI });
    const cookie = await sessionCookieFor(user.username);

    expect(await session.getUser(cookie)).toMatchObject({ id: user.id, role: Role.PEGAWAI });
  });

  it("sees a role change made by a Super Admin on the next request", async () => {
    const user = await users.createUser({ role: Role.MANAGER });
    const cookie = await sessionCookieFor(user.username);

    await prisma.user.update({ where: { id: user.id }, data: { role: Role.PEGAWAI } });

    expect(await session.check(cookie, [Role.MANAGER])).toMatchObject({ status: "forbidden" });
  });

  it("drops a deactivated user even before their sessions are revoked", async () => {
    const user = await users.createUser();
    const cookie = await sessionCookieFor(user.username);

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    expect(await session.getUser(cookie)).toBeNull();
  });

  it("ends every session of a user on revokeAll", async () => {
    const user = await users.createUser();
    const phone = await sessionCookieFor(user.username);
    const laptop = await sessionCookieFor(user.username);

    await session.revokeAll(user.id);

    expect(await session.getUser(phone)).toBeNull();
    expect(await session.getUser(laptop)).toBeNull();
  });
});
