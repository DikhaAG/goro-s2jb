import { describe, it, expect } from "vitest";
import { intakeReviewSchema, MAX_FILE_SIZE_BYTES } from "@/lib/validators/intake";

describe("Intake Form Validation Schema (src/lib/validators/intake.ts)", () => {
  const validPayload = {
    up3Id: "up3_plg_test",
    ulpId: "ulp_riv_test",
    playstoreReviewerName: "Ahmad Dani",
    entryDate: "2026-05-20",
    appVersionId: "ver_5279_test",
    originalReviewerName: "Ahmad Dani",
    reviewerCategory: "Pelanggan",
    fieldNotes: "Rating bintang 5 mantap",
    evidenceImageBase64: "data:image/jpeg;base64," + Buffer.from("dummy-image-bytes").toString("base64"),
    evidenceFilename: "bukti_rating.jpg",
  };

  it("should pass validation for complete and valid field review input", () => {
    const result = intakeReviewSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("should fail validation when required fields are missing", () => {
    const emptyPayload = {
      up3Id: "",
      ulpId: "",
      playstoreReviewerName: "",
      entryDate: "",
      appVersionId: "",
      evidenceImageBase64: "",
    };

    const result = intakeReviewSchema.safeParse(emptyPayload);
    expect(result.success).toBe(false);

    if (!result.success) {
      const fieldErrors = result.error.issues.map((i) => i.path[0]);
      expect(fieldErrors).toContain("up3Id");
      expect(fieldErrors).toContain("ulpId");
      expect(fieldErrors).toContain("playstoreReviewerName");
      expect(fieldErrors).toContain("entryDate");
      expect(fieldErrors).toContain("appVersionId");
      expect(fieldErrors).toContain("evidenceImageBase64");
    }
  });

  it("should reject invalid date format", () => {
    const result = intakeReviewSchema.safeParse({
      ...validPayload,
      entryDate: "20-05-2026", // Wrong format (expected YYYY-MM-DD)
    });
    expect(result.success).toBe(false);
  });

  it("should reject disallowed file types (e.g. PDF or GIF)", () => {
    const pdfDataUrl = "data:application/pdf;base64," + Buffer.from("fake-pdf").toString("base64");
    const result = intakeReviewSchema.safeParse({
      ...validPayload,
      evidenceImageBase64: pdfDataUrl,
    });
    expect(result.success).toBe(false);
  });

  it("should reject image exceeding 5MB size limit", () => {
    // Generate base64 string larger than 5MB
    const largeBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024, "a");
    const largeBase64 = "data:image/jpeg;base64," + largeBuffer.toString("base64");

    const result = intakeReviewSchema.safeParse({
      ...validPayload,
      evidenceImageBase64: largeBase64,
    });
    expect(result.success).toBe(false);
  });
});
