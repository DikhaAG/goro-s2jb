import { randomUUID } from "crypto";
import type { Role } from "@prisma/client";
import type { SessionUser } from "@/types";

export type SessionCheck =
  | { status: "ok"; user: SessionUser }
  | { status: "unauthenticated" }
  | { status: "forbidden"; user: SessionUser; requiredRole: Role };

export type ChangePasswordResult = "changed" | "wrong_current_password";

/** Where Sesi Pengguna are stored and resolved: better-auth in production, memory in tests. */
export interface SessionAdapter {
  resolveUser(headers: Headers): Promise<SessionUser | null>;
  revokeAll(userId: string): Promise<void>;
  /** Sets the credential password (creating it if missing). Callers decide whether to revoke. */
  setPassword(userId: string, password: string): Promise<void>;
  /** Changes the signed-in user's password and ends their other sessions. */
  changeOwnPassword(
    headers: Headers,
    currentPassword: string,
    newPassword: string
  ): Promise<ChangePasswordResult>;
}

export interface Session {
  getUser(headers: Headers): Promise<SessionUser | null>;
  check(headers: Headers, allowedRoles?: readonly Role[]): Promise<SessionCheck>;
  revokeAll(userId: string): Promise<void>;
  /** Sets a password for a new account; no sessions exist yet. */
  setInitialPassword(userId: string, password: string): Promise<void>;
  /** Super Admin reset: sets the password and ends every session of that user. */
  resetPassword(userId: string, password: string): Promise<void>;
  changeOwnPassword(
    headers: Headers,
    currentPassword: string,
    newPassword: string
  ): Promise<ChangePasswordResult>;
}

export function createSession(adapter: SessionAdapter): Session {
  return {
    getUser: (headers) => adapter.resolveUser(headers),
    async check(headers, allowedRoles) {
      const user = await adapter.resolveUser(headers);
      if (!user) return { status: "unauthenticated" };
      if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
        return { status: "forbidden", user, requiredRole: allowedRoles[0] };
      }
      return { status: "ok", user };
    },
    revokeAll: (userId) => adapter.revokeAll(userId),
    setInitialPassword: (userId, password) => adapter.setPassword(userId, password),
    async resetPassword(userId, password) {
      await adapter.setPassword(userId, password);
      await adapter.revokeAll(userId);
    },
    changeOwnPassword: (headers, currentPassword, newPassword) =>
      adapter.changeOwnPassword(headers, currentPassword, newPassword),
  };
}

export function createInMemorySessionAdapter(cookieName = "session") {
  const sessions = new Map<string, SessionUser>();
  const passwords = new Map<string, string>();

  function tokenFrom(headers: Headers): string | null {
    const cookie = headers.get("cookie") ?? "";
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  return {
    signIn(user: SessionUser): string {
      const token = randomUUID();
      sessions.set(token, user);
      return token;
    },
    async resolveUser(headers: Headers) {
      const token = tokenFrom(headers);
      return (token && sessions.get(token)) || null;
    },
    async revokeAll(userId: string) {
      for (const [token, user] of sessions) {
        if (user.id === userId) sessions.delete(token);
      }
    },
    async setPassword(userId: string, password: string) {
      passwords.set(userId, password);
    },
    async changeOwnPassword(headers: Headers, currentPassword: string, newPassword: string) {
      const token = tokenFrom(headers);
      const user = token ? sessions.get(token) : undefined;
      if (!user || passwords.get(user.id) !== currentPassword) return "wrong_current_password";
      passwords.set(user.id, newPassword);
      for (const [other, owner] of sessions) {
        if (owner.id === user.id && other !== token) sessions.delete(other);
      }
      return "changed";
    },
  } satisfies SessionAdapter & { signIn(user: SessionUser): string };
}
