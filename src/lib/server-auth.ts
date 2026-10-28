import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { SessionUser } from "@/types";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth";

/**
 * Retrieves the current session user from incoming HTTP request cookies.
 * Runs on the server side (Server Components, Layouts, Server Actions).
 */
export async function getServerSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch (error) {
    console.error("[getServerSession Error]", error);
    return null;
  }
}

/**
 * Defense-in-Depth Server Guard (Layer 2).
 * Verifies that a valid session exists and optionally checks if the user's role
 * is authorized. If unauthenticated, immediately redirects to /login.
 * If unauthorized, immediately redirects to /unauthorized.
 */
export async function requireServerAuth(allowedRoles?: Role[]): Promise<SessionUser> {
  const user = await getServerSession();

  if (!user) {
    redirect("/login");
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const primaryRequiredRole = allowedRoles[0];
    redirect(`/unauthorized?required=${primaryRequiredRole}`);
  }

  return user;
}
