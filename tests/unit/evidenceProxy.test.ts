import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/evidence/proxy/[reviewId]/route";
import prisma from "@/lib/prisma";

describe("Smart Evidence Streaming Proxy (GET /api/evidence/proxy/[reviewId])", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should return 404 when review is not found in database", async () => {
    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValueOnce(null as any);

    const req = new NextRequest("http://localhost:3000/api/evidence/proxy/non-existent-id");
    const res = await GET(req, { params: Promise.resolve({ reviewId: "non-existent-id" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Eviden ulasan tidak ditemukan");
  });

  it("should stream Google Drive evidence image with proper Cache-Control header", async () => {
    vi.spyOn(prisma.ratingReview, "findUnique").mockResolvedValueOnce({
      id: "rev-gdrive-123",
      evidenceImagePath: "https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz",
    } as any);

    const fakeImageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG header
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => fakeImageBytes.buffer,
    });

    const req = new NextRequest("http://localhost:3000/api/evidence/proxy/rev-gdrive-123");
    const res = await GET(req, { params: Promise.resolve({ reviewId: "rev-gdrive-123" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("max-age=86400");
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

    const req = new NextRequest("http://localhost:3000/api/evidence/proxy/rev-broken-link");
    const res = await GET(req, { params: Promise.resolve({ reviewId: "rev-broken-link" }) });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("Gagal mengalirkan gambar");
  });
});
