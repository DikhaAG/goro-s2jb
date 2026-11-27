import { test, expect } from "@playwright/test";

// Calls the real server so it fails when Next does not load src/proxy.ts.
// Only the proxy adds ?redirect=; the layout guard redirects to a bare /login.
test("Next loads src/proxy.ts for protected routes", async ({ request, baseURL }) => {
  const response = await request.get("/reviews", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  const location = new URL(response.headers()["location"] ?? "", baseURL);
  expect(location.pathname).toBe("/login");
  expect(location.searchParams.get("redirect")).toBe("/reviews");
});

// API routes enforce their own auth; the proxy must let anonymous calls reach them.
test("proxy leaves /api routes to their own auth", async ({ request }) => {
  const response = await request.post("/api/auth/sign-in/username", {
    data: { username: "e2e_nobody", password: "wrong-password" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ code: "INVALID_CREDENTIALS" });
});
