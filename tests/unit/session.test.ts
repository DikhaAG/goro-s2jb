import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import { createSession, createInMemorySessionAdapter } from "@/server/session";
import type { SessionUser } from "@/types";

const manager: SessionUser = {
  id: "usr_manager",
  username: "manager",
  name: "Manager",
  role: Role.MANAGER,
  up3Id: null,
  ulpId: null,
};

function headersWithToken(token: string): Headers {
  return new Headers({ cookie: `session=${token}` });
}

describe("Sesi Pengguna module", () => {
  const adapter = createInMemorySessionAdapter();
  const token = adapter.signIn(manager);
  const session = createSession(adapter);

  it("is unauthenticated without a known session", async () => {
    expect(await session.check(new Headers())).toEqual({ status: "unauthenticated" });
    expect(await session.check(headersWithToken("forged"))).toEqual({ status: "unauthenticated" });
  });

  it("returns the user when no role is required", async () => {
    expect(await session.check(headersWithToken(token))).toEqual({ status: "ok", user: manager });
  });

  it("is forbidden when the role is not allowed, naming the first required role", async () => {
    const result = await session.check(headersWithToken(token), [Role.SUPER_ADMIN, Role.PEGAWAI]);
    expect(result).toEqual({ status: "forbidden", user: manager, requiredRole: Role.SUPER_ADMIN });
  });

  it("ends immediately when the session is revoked", async () => {
    await adapter.revokeAll(manager.id);
    expect(await session.check(headersWithToken(token))).toEqual({ status: "unauthenticated" });
  });
});
