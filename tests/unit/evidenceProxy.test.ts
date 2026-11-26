import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { GET } from "@/app/api/evidence/proxy/[reviewId]/route";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

describe("Smart Evidence Streaming Proxy (GET /api/evidence/proxy/[reviewId])", () => {
  const originalFetch = global.fetch;
  let operatorToken: string;

  beforeEach(async () => {
    operatorToken = await signSessionToken({
      id: "user-operator-1",
      username: "operator1",
      name: "Operator Triase",
      role: Role.PEGAWAI,
      up3Id: null,
      ulpId: null,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should reject unauthenticated requests with 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/evidence/proxy/rev-1");
    const res = await GET(req, { params: Promise.resolve({ reviewId: "rev-1" }) });

    expect(res.status).toBe(401);
  });

  it("should return 404 when review is not found in database", async () => {
    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValueOnce(null as any);

    const req = new NextRequest("http://localhost:3000/api/evidence/proxy/non-existent-id", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
    });
    const res = await GET(req, { params: Promise.resolve({ reviewId: "non-existent-id" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Eviden ulasan tidak ditemukan");
  });

  it("should stream Google Drive evidence image with private Cache-Control and nosniff headers", async () => {
    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValueOnce({
      id: "rev-gdrive-123",
      evidenceImagePath: "https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz",
    } as any);

    const fakeImageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://drive.google.com/uc?id=1AbCdEfGhIjKlMnOpQrStUvWxYz&export=download",
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => fakeImageBytes.buffer,
    });

    const req = new NextRequest("http://localhost:3000/api/evidence/proxy/rev-gdrive-123", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
    });
    const res = await GET(req, { params: Promise.resolve({ reviewId: "rev-gdrive-123" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("should block SSRF internal network URLs and return 502", async () => {
    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValueOnce({
      id: "rev-ssrf",
      evidenceImagePath: "http://127.0.0.1:8001/health",
    } as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const req = new NextRequest("http://localhost:3000/api/evidence/proxy/rev-ssrf", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
    });
    const res = await GET(req, { params: Promise.resolve({ reviewId: "rev-ssrf" }) });

    expect(res.status).toBe(502);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should return 502 Bad Gateway when upstream Google Drive fails to deliver image", async () => {
    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValueOnce({
      id: "rev-broken-link",
      evidenceImagePath: "https://drive.google.com/open?id=broken_file_id",
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "text/html" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    const req = new NextRequest("http://localhost:3000/api/evidence/proxy/rev-broken-link", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${operatorToken}` },
    });
    const res = await GET(req, { params: Promise.resolve({ reviewId: "rev-broken-link" }) });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("Gagal mengalirkan gambar");
  });
});
