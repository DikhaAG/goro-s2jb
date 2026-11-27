import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { SessionUser } from "@/types";
import { session } from "@/server/session/live";

/**
 * Retrieves the current Sesi Pengguna in Server Components, Layouts and Server Actions.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  return session.getUser(await headers());
}

/**
 * Defense-in-Depth Server Guard (Layer 2).
 * Verifies that a valid session exists and optionally checks if the user's role
 * is authorized. If unauthenticated, immediately redirects to /login.
 * If unauthorized, immediately redirects to /unauthorized.
 */
export async function requireServerAuth(allowedRoles?: Role[]): Promise<SessionUser> {
  const result = await session.check(await headers(), allowedRoles);

  if (result.status === "unauthenticated") {
    redirect("/login");
  }
  if (result.status === "forbidden") {
    redirect(`/unauthorized?required=${result.requiredRole}`);
  }

  return result.user;
}
