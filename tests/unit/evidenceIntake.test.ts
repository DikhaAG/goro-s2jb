import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createEvidenceIntake, type EvidenceSubmission } from "@/server/services/evidenceIntake";

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

const officer = { id: "usr_field_01", up3Id: "up3_plg", ulpId: "ulp_riv" };

function submission(overrides: Partial<EvidenceSubmission> = {}): EvidenceSubmission {
  return {
    up3Id: "up3_plg",
    ulpId: "ulp_riv",
    playstoreReviewerName: "Rina Pelanggan",
    entryDate: "2026-11-27",
    appVersionId: "ver_1",
    originalReviewerName: "",
    reviewerCategory: "Pelanggan",
    fieldNotes: "",
    evidence: JPEG_BYTES,
    ...overrides,
  };
}

function listStoredFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return (fs.readdirSync(root, { recursive: true }) as string[])
    .map((p) => path.join(root, p))
    .filter((p) => fs.statSync(p).isFile());
}

describe("Pengumpulan Eviden (evidenceIntake.submit)", () => {
  let storageRoot: string;
  let prisma: any;
  let uploadQuota: { consume: ReturnType<typeof vi.fn> };
  let enqueueVerification: ReturnType<typeof vi.fn>;

  function intake() {
    return createEvidenceIntake({ prisma, storageRoot, uploadQuota, enqueueVerification });
  }

  beforeEach(async () => {
    storageRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "evidence-intake-"));
    prisma = {
      uLP: { findFirst: vi.fn().mockResolvedValue({ id: "ulp_riv" }) },
      ratingReview: {
        create: vi.fn().mockResolvedValue({ id: "rev_123" }),
        delete: vi.fn().mockResolvedValue({ id: "rev_123" }),
      },
    };
    uploadQuota = { consume: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }) };
    enqueueVerification = vi.fn().mockResolvedValue({ enqueuedCount: 1, jobIds: ["job_1"] });
  });

  afterEach(async () => {
    await fs.promises.rm(storageRoot, { recursive: true, force: true });
  });

  it("accepts a valid submission: stores the image under its entry date, records a PENDING review and queues Verifikasi Eviden", async () => {
    const result = await intake().submit(officer, submission());

    expect(result).toEqual({ ok: true, reviewId: "rev_123", evidencePath: expect.any(String) });
    if (!result.ok) return;

    expect(result.evidencePath).toMatch(/^evidence\/2026\/11\/27\/eviden_\d+_[0-9a-f]{16}\.jpg$/);
    expect(fs.readFileSync(path.join(storageRoot, result.evidencePath))).toEqual(JPEG_BYTES);

    expect(prisma.ratingReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        up3Id: "up3_plg",
        ulpId: "ulp_riv",
        playstoreReviewerName: "Rina Pelanggan",
        originalReviewerName: "Rina Pelanggan",
        entryDate: new Date("2026-11-27"),
        evidenceImagePath: result.evidencePath,
        appVersionId: "ver_1",
        reviewerCategory: "Pelanggan",
        fieldNotes: null,
        validationStatus: "PENDING",
        source: "INTAKE",
        submittedById: "usr_field_01",
      }),
    });
    expect(enqueueVerification).toHaveBeenCalledWith(
      { reviewId: "rev_123", evidenceImagePath: result.evidencePath, expectedReviewerName: "Rina Pelanggan" },
      expect.objectContaining({ priority: 1, markQueuedInDb: false })
    );
  });

  it("names the stored file after the detected image type, not after anything the client claims", async () => {
    const result = await intake().submit(officer, submission({ evidence: PNG_BYTES }));

    expect(result.ok && result.evidencePath).toMatch(/\.png$/);
  });

  it.each([
    ["a PDF", Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj")],
    ["an empty file", Buffer.alloc(0)],
    ["a JPEG over 5 MB", Buffer.concat([JPEG_BYTES, Buffer.alloc(5 * 1024 * 1024)])],
  ])("rejects %s as invalid-file without storing anything or recording a review", async (_label, evidence) => {
    const result = await intake().submit(officer, submission({ evidence }));

    expect(result).toEqual({ ok: false, reason: "invalid-file" });
    expect(listStoredFiles(storageRoot)).toEqual([]);
    expect(prisma.ratingReview.create).not.toHaveBeenCalled();
  });

  it("rejects a ULP that does not sit under the chosen UP3 as invalid-unit-pair", async () => {
    prisma.uLP.findFirst.mockResolvedValue(null);

    const result = await intake().submit(officer, submission({ up3Id: "up3_plg", ulpId: "ulp_under_other_up3" }));

    expect(result).toEqual({ ok: false, reason: "invalid-unit-pair" });
    expect(prisma.uLP.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ulp_under_other_up3", up3Id: "up3_plg" } })
    );
    expect(listStoredFiles(storageRoot)).toEqual([]);
    expect(prisma.ratingReview.create).not.toHaveBeenCalled();
  });

  it("charges the upload quota to the officer and rejects as quota-exceeded once it is spent", async () => {
    uploadQuota.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });

    const result = await intake().submit(officer, submission());

    expect(uploadQuota.consume).toHaveBeenCalledWith("usr_field_01");
    expect(result).toEqual({ ok: false, reason: "quota-exceeded", retryAfterSeconds: 42 });
    expect(listStoredFiles(storageRoot)).toEqual([]);
    expect(prisma.ratingReview.create).not.toHaveBeenCalled();
  });

  it("removes the stored image and rethrows when the review cannot be recorded", async () => {
    const dbError = new Error("Foreign key constraint violated: RatingReview_appVersionId_fkey");
    prisma.ratingReview.create.mockRejectedValue(dbError);

    await expect(intake().submit(officer, submission({ appVersionId: "ver_missing" }))).rejects.toBe(dbError);

    expect(listStoredFiles(storageRoot)).toEqual([]);
  });

  it("withdraws the review and the stored image and rejects as queue-unavailable when Verifikasi Eviden cannot be queued", async () => {
    const queueError = new Error("Redis version needs to be greater or equal than 6.2.0");
    enqueueVerification.mockRejectedValue(queueError);

    const result = await intake().submit(officer, submission());

    expect(result).toEqual({ ok: false, reason: "queue-unavailable", cause: queueError });
    expect(prisma.ratingReview.delete).toHaveBeenCalledWith({ where: { id: "rev_123" } });
    expect(listStoredFiles(storageRoot)).toEqual([]);
  });
});
