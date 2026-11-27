import { createInMemorySessionAdapter, createSession } from "@/server/session";
import type { SessionUser } from "@/types";

/**
 * In-memory Sesi Pengguna for tests that exercise the proxy, layouts or route
 * handlers with fictional users. Each test file swaps the live module with:
 *
 *   vi.mock("@/server/session/live", async () =>
 *     (await import("../helpers/fakeSession")).liveSessionModule());
 */
export const SESSION_COOKIE_NAME = "goro_test_session";

const adapter = createInMemorySessionAdapter(SESSION_COOKIE_NAME);
const session = createSession(adapter);

export function liveSessionModule() {
  return { session };
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return adapter.signIn(user);
}
