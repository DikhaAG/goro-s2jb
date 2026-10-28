import { describe, it, expect, beforeAll } from "vitest";
import { GET } from "@/app/api/uploads/[...path]/route";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

describe("Secure Uploads Route Handler (/api/uploads/[...path])", () => {
  let validAuthCookie: string;

  beforeAll(async () => {
    const token = await signSessionToken({
      id: "test-officer-id",
      username: "petugas_test",
      name: "Petugas Lapangan",
      role: Role.PETUGAS_LAPANGAN,
    });
    validAuthCookie = `${SESSION_COOKIE_NAME}=${token}`;
  });

  it("should reject unauthenticated requests with 401 status", async () => {
    const req = new NextRequest("http://localhost:3000/api/uploads/test/sample_budi.png");
    const response = await GET(req, {
      params: Promise.resolve({ path: ["test", "sample_budi.png"] }),
    });

    expect(response.status).toBe(401);
  });

  it("should serve existing evidence image with correct Content-Type header when authenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/uploads/test/sample_budi.png", {
      headers: {
        cookie: validAuthCookie,
      },
    });
    const response = await GET(req, {
      params: Promise.resolve({ path: ["test", "sample_budi.png"] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("should reject path traversal attempts with 403 status when authenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/uploads/../../package.json", {
      headers: {
        cookie: validAuthCookie,
      },
    });
    const response = await GET(req, {
      params: Promise.resolve({ path: ["..", "..", "package.json"] }),
    });

    expect(response.status).toBe(403);
  });

  it("should return 404 for non-existent image when authenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/uploads/test/not_exist.jpg", {
      headers: {
        cookie: validAuthCookie,
      },
    });
    const response = await GET(req, {
      params: Promise.resolve({ path: ["test", "not_exist.jpg"] }),
    });

    expect(response.status).toBe(404);
  });

  it("should return 400 for empty path when authenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/uploads/", {
      headers: {
        cookie: validAuthCookie,
      },
    });
    const response = await GET(req, {
      params: Promise.resolve({ path: [] }),
    });

    expect(response.status).toBe(400);
  });
});
