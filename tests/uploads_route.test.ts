import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/uploads/[...path]/route";
import { NextRequest } from "next/server";
import path from "path";

describe("Secure Uploads Route Handler (/api/uploads/[...path])", () => {
  it("should serve existing evidence image with correct Content-Type header", async () => {
    const req = new NextRequest("http://localhost:3000/api/uploads/test/sample_budi.png");
    const response = await GET(req, {
      params: Promise.resolve({ path: ["test", "sample_budi.png"] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("should reject path traversal attempts with 403 status", async () => {
    const req = new NextRequest("http://localhost:3000/api/uploads/../../package.json");
    const response = await GET(req, {
      params: Promise.resolve({ path: ["..", "..", "package.json"] }),
    });

    expect(response.status).toBe(403);
  });

  it("should return 404 for non-existent image", async () => {
    const req = new NextRequest("http://localhost:3000/api/uploads/test/not_exist.jpg");
    const response = await GET(req, {
      params: Promise.resolve({ path: ["test", "not_exist.jpg"] }),
    });

    expect(response.status).toBe(404);
  });

  it("should return 400 for empty path", async () => {
    const req = new NextRequest("http://localhost:3000/api/uploads/");
    const response = await GET(req, {
      params: Promise.resolve({ path: [] }),
    });

    expect(response.status).toBe(400);
  });
});
