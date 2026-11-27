import { isAPIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSession, type SessionAdapter } from "./index";

/**
 * better-auth validates the session token (Redis, then Postgres); the user is
 * then reloaded from Postgres so role changes and deactivation apply on the
 * next request instead of when the cached session expires.
 */
const betterAuthAdapter: SessionAdapter = {
  async resolveUser(headers) {
    const result = await auth.api.getSession({ headers });
    if (!result) return null;

    const user = await prisma.user.findUnique({
      where: { id: result.user.id },
      select: { id: true, username: true, name: true, role: true, isActive: true, up3Id: true, ulpId: true },
    });
    if (!user?.isActive) return null;

    const { isActive: _isActive, ...sessionUser } = user;
    return sessionUser;
  },
  async revokeAll(userId) {
    const context = await auth.$context;
    await context.internalAdapter.deleteUserSessions(userId);
  },
  async setPassword(userId, password) {
    const context = await auth.$context;
    const hash = await context.password.hash(password);
    const credential = await context.internalAdapter.findCredentialAccount(userId);
    if (credential) {
      await context.internalAdapter.updatePassword(userId, hash);
    } else {
      await context.internalAdapter.linkAccount({
        userId,
        accountId: userId,
        providerId: "credential",
        password: hash,
      });
    }
  },
  async changeOwnPassword(headers, currentPassword, newPassword) {
    try {
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers,
      });
      return "changed";
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
        return "wrong_current_password";
      }
      throw error;
    }
  },
};

export const session = createSession(betterAuthAdapter);
