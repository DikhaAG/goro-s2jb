import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Role } from "@prisma/client";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { createContext } from "@/server/context";
import { auth, hashPassword } from "@/lib/auth";
import { createUserFactory, sessionCookieFor } from "../helpers/authUsers";
import prisma from "@/lib/prisma";

const sessionUsers = createUserFactory("it");

function contextFor(headers: Record<string, string>) {
  const req = new Request("http://localhost:3000/api/trpc/auth.getSession", { headers });
  return createContext({ req } as FetchCreateContextFnOptions);
}

describe("Sesi Pengguna: tRPC context only trusts a signed session", () => {
  let superAdminId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    const admin = await prisma.user.create({
      data: {
        username: `test_identity_admin_${suffix}`,
        email: `test_identity_admin_${suffix}@pln.co.id`,
        name: "Identity Trust Admin",
        role: Role.SUPER_ADMIN,
      },
    });
    superAdminId = admin.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: superAdminId } }).catch(() => {});
    await sessionUsers.cleanup();
  });

  it("ignores a client-supplied x-user-id header", async () => {
    const ctx = await contextFor({ "x-user-id": superAdminId });
    expect(ctx.user).toBeNull();
  });

  it("ignores an unsigned goro_user_id cookie", async () => {
    const ctx = await contextFor({ cookie: `goro_user_id=${superAdminId}` });
    expect(ctx.user).toBeNull();
  });

  it("still resolves the user from a valid better-auth session cookie", async () => {
    const admin = await sessionUsers.createUser({ role: Role.SUPER_ADMIN });
    const cookie = await sessionCookieFor(admin.username);

    const ctx = await contextFor({ cookie: cookie.get("cookie")! });

    expect(ctx.user).toMatchObject({ id: admin.id, role: Role.SUPER_ADMIN });
  });
});

describe("Sesi Pengguna: better-auth endpoints cannot create or elevate users", () => {
  const suffix = Date.now();
  const signUpUsername = `test_signup_${suffix}`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: signUpUsername } });
  });

  it("rejects public self sign-up", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          email: `${signUpUsername}@pln.co.id`,
          password: "Str0ng-Passw0rd!",
          name: "Self Sign Up",
          username: signUpUsername,
        },
      })
    ).rejects.toThrow("Email and password sign up is not enabled");
  });

  describe("a signed-in Petugas Lapangan", () => {
    const username = `test_elevate_${suffix}`;
    const password = "Str0ng-Passw0rd!";
    let userId: string;
    let sessionHeaders: Headers;

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          username,
          email: `${username}@pln.co.id`,
          name: "Elevation Attempt",
          role: Role.PETUGAS_LAPANGAN,
        },
      });
      userId = user.id;
      await prisma.account.create({
        data: {
          userId,
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(password),
        },
      });

      const { headers } = await auth.api.signInUsername({
        body: { username, password },
        returnHeaders: true,
      });
      const cookie = headers
        .getSetCookie()
        .map((setCookie) => setCookie.split(";")[0])
        .join("; ");
      sessionHeaders = new Headers({ cookie });
    });

    afterAll(async () => {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    });

    it.each([
      ["role", Role.SUPER_ADMIN],
      ["isActive", true],
      ["up3Id", "up3_not_mine"],
      ["ulpId", "ulp_not_mine"],
    ])("cannot set %s on their own account", async (field, value) => {
      await expect(
        auth.api.updateUser({ body: { [field]: value }, headers: sessionHeaders })
      ).rejects.toThrow(`${field} is not allowed to be set`);

      const session = await auth.api.getSession({
        headers: sessionHeaders,
        query: { disableCookieCache: true },
      });
      expect(session?.user).toMatchObject({ role: Role.PETUGAS_LAPANGAN, isActive: true });
    });
  });
});
