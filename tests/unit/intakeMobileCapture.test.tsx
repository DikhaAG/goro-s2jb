import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const trpcProxy: any = vi.hoisted(() => {
  const proxy: any = new Proxy(
    () => ({
      data: [{ id: "ver-1", version: "V5.2.79" }],
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      mutateAsync: vi.fn(),
    }),
    {
      get(_target, prop) {
        if (prop === "useQuery" || prop === "useMutation") {
          return () => proxy();
        }
        return proxy;
      },
    }
  );
  return proxy;
});

vi.mock("@/lib/trpc", () => ({
  trpc: trpcProxy,
}));

import { IntakeForm } from "@/components/forms/IntakeForm";
import {
  computeNormalizedDimensions,
  isHeicFile,
  isSupportedImageCandidate,
  normalizeEvidenceImageFile,
  normalizeFilenameForMime,
} from "@/lib/client/evidenceImageNormalizer";
import { validateEvidenceMime } from "@/lib/storage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("IntakeForm mobile camera & gallery capture", () => {
  it("renders separate camera (capture=environment) and gallery (no capture) inputs with 44px buttons", () => {
    const html = renderToStaticMarkup(<IntakeForm />);

    expect(html).toContain("Eviden Ulasan (Foto Kamera Langsung / Tangkapan Layar)");
    expect(html).toContain("Ambil Foto Kamera");
    expect(html).toContain("Pilih dari Galeri / File");
    expect(html).toContain("min-h-[44px]");
    expect(html).toContain("focus-utility-ring");

    // Camera input must trigger rear camera
    expect(html).toMatch(/<input[^>]*accept="image\/\*"[^>]*capture="environment"[^>]*>/);
    // Gallery input must allow JPG/PNG/WebP/HEIC/HEIF without forcing capture=environment
    expect(html).toMatch(
      /<input[^>]*accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif,\.jpg,\.jpeg,\.png,\.webp,\.heic,\.heif"[^>]*>/
    );
    expect(html).not.toMatch(
      /<input[^>]*accept="image\/jpeg,image\/png,image\/webp,image\/heic,image\/heif[^"]*"[^>]*capture=/
    );
    // Comply with no-em-dash UI rule
    expect(html).not.toContain("\u2014");
  });
});

describe("evidenceImageNormalizer utilities", () => {
  it("detects HEIC/HEIF files by MIME type or extension even when browser leaves MIME empty", () => {
    expect(isHeicFile({ name: "IMG_1024.HEIC", type: "" })).toBe(true);
    expect(isHeicFile({ name: "photo.heif", type: "application/octet-stream" })).toBe(true);
    expect(isHeicFile({ name: "photo.bin", type: "image/heic" })).toBe(true);
    expect(isHeicFile({ name: "screenshot.png", type: "image/png" })).toBe(false);
  });

  it("validates supported image candidates and rejects non-image files", () => {
    expect(isSupportedImageCandidate({ name: "capture.jpg", type: "image/jpeg" })).toBe(true);
    expect(isSupportedImageCandidate({ name: "iphone.heic", type: "" })).toBe(true);
    expect(isSupportedImageCandidate({ name: "doc.pdf", type: "application/pdf" })).toBe(false);
  });

  it("normalizes filenames cleanly to match storage MIME validation", () => {
    const jpgName = normalizeFilenameForMime("IMG_9981.HEIC", "image/jpeg");
    expect(jpgName).toBe("IMG_9981.jpg");
    expect(validateEvidenceMime("image/jpeg", jpgName)).toBe(true);

    const noExtName = normalizeFilenameForMime("100004512", "image/jpeg");
    expect(noExtName).toBe("100004512.jpg");
    expect(validateEvidenceMime("image/jpeg", noExtName)).toBe(true);
  });

  it("preserves dimensions <= 1920px and downscales high-megapixel photos while keeping aspect ratio", () => {
    expect(computeNormalizedDimensions(1080, 1920)).toEqual({
      width: 1080,
      height: 1920,
      wasResized: false,
    });

    expect(computeNormalizedDimensions(4032, 3024)).toEqual({
      width: 1920,
      height: 1440,
      wasResized: true,
    });
  });

  it("keeps compact PNG screenshots untouched to preserve crisp OCR text", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({
      width: 1080,
      height: 1920,
      close: vi.fn(),
    }));

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.result = "data:image/png;base64,iVBORw0KGgo=";
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const file = new File([new Uint8Array(256)], "screenshot.png", { type: "image/png" });
    const res = await normalizeEvidenceImageFile(file);

    expect(res.wasNormalized).toBe(false);
    expect(res.wasHeicConverted).toBe(false);
    expect(res.mimeType).toBe("image/png");
    expect(res.filename).toBe("screenshot.png");
    expect(res.dataUrl).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("converts iOS HEIC photos, downscales > 1920px, and rewrites filename to .jpg", async () => {
    const closeSpy = vi.fn();
    vi.stubGlobal("createImageBitmap", async () => ({
      width: 4032,
      height: 3024,
      close: closeSpy,
    }));

    const fillRectSpy = vi.fn();
    const drawImageSpy = vi.fn();
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: "",
        fillRect: fillRectSpy,
        drawImage: drawImageSpy,
      }),
      toBlob: (cb: (b: Blob | null) => void) => {
        cb(new Blob([new Uint8Array(1024)], { type: "image/jpeg" }));
      },
    };
    vi.stubGlobal("document", {
      createElement: () => fakeCanvas,
    });

    class MockFileReader {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.result = "data:image/jpeg;base64,/9j/4AAQ";
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    const heicFile = new File([new Uint8Array(4096)], "IMG_0420.HEIC", { type: "image/heic" });
    const mockHeicConvert = vi.fn(async () => new Blob([new Uint8Array(2048)], { type: "image/jpeg" }));

    const res = await normalizeEvidenceImageFile(heicFile, {
      heicConvertFn: mockHeicConvert,
    });

    expect(mockHeicConvert).toHaveBeenCalledTimes(1);
    expect(res.wasHeicConverted).toBe(true);
    expect(res.wasNormalized).toBe(true);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1440);
    expect(res.mimeType).toBe("image/jpeg");
    expect(res.filename).toBe("IMG_0420.jpg");
    expect(validateEvidenceMime(res.mimeType, res.filename)).toBe(true);
    expect(closeSpy).toHaveBeenCalled();
    expect(fillRectSpy).toHaveBeenCalledWith(0, 0, 1920, 1440);
  });

  it("rejects unsupported non-image files with a clear Indonesian message", async () => {
    const pdfFile = new File([new Uint8Array(100)], "dokumen.pdf", { type: "application/pdf" });
    await expect(normalizeEvidenceImageFile(pdfFile)).rejects.toThrow(
      "Format file harus JPG, PNG, WebP, atau HEIC/HEIF"
    );
  });
});

