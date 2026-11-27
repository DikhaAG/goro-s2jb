import { Role } from "@prisma/client";
import { auth, hashPassword } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const TEST_PASSWORD = "Str0ng-Passw0rd!";

const runId = Date.now() % 1_000_000;
let userCounter = 0;
let ipCounter = 0;

/** Tracks users created by a test file so afterAll can remove them. */
export function createUserFactory(prefix: string) {
  const createdIds: string[] = [];

  async function createUser(
    options: { role?: Role; isActive?: boolean; passwordHash?: string; name?: string } = {}
  ) {
    userCounter += 1;
    const username = `${prefix}${userCounter}_${runId}`;
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@pln.co.id`,
        name: options.name ?? username,
        role: options.role ?? Role.PETUGAS_LAPANGAN,
        isActive: options.isActive ?? true,
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: options.passwordHash ?? (await hashPassword(TEST_PASSWORD)),
      },
    });
    createdIds.push(user.id);
    return user;
  }

  async function cleanup() {
    await prisma.auditLog.deleteMany({ where: { userId: { in: createdIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  }

  return { createUser, cleanup };
}

export function freshIp(): string {
  ipCounter += 1;
  return `10.99.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

export function signIn(username: string, password: string, ip: string = freshIp()) {
  return auth.api.signInUsername({
    body: { username, password },
    headers: new Headers({ "x-real-ip": ip }),
    returnHeaders: true,
  });
}

/** Turns a sign-in's Set-Cookie headers into the Cookie header a browser would send. */
export function cookieHeaderFrom(headers: Headers): Headers {
  const cookie = headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

/** Signs a user in through better-auth and returns the browser Cookie header. */
export async function sessionCookieFor(username: string): Promise<Headers> {
  const { headers } = await signIn(username, TEST_PASSWORD);
  return cookieHeaderFrom(headers);
}
