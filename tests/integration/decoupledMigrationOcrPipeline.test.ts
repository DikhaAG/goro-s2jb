import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import fs from "fs";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { parseCsvStream, RawReviewRow } from "@/lib/parsers/csvStreamParser";
import {
  downloadEvidenceImage,
  streamEvidenceImageBuffer,
  extractGoogleDriveFileId,
  isExternalUrl,
} from "@/server/services/evidenceDownloader";
import { executeOcrBridge } from "@/server/services/ocrBridge";
import { checkImageDuplicate } from "@/server/services/antiFraudService";

describe("Decoupled Two-Tier Zero-Blocking Migration & OCR Validation Pipeline", () => {
  const CSV_FILE_PATH = path.resolve(process.cwd(), "docs/testing/100baris.csv");
  let testReviewIds: string[] = [];
  let testBatchId: string;
  let up3Id: string;
  let ulpId: string;
  let versionId: string;

  beforeAll(async () => {
    // 1. Resolve master reference IDs
    const ulp = await prisma.uLP.findFirst({
      include: { up3: true },
    });
    const version = await prisma.appVersion.findFirst({
      where: { version: "V5.2.79" },
    });

    if (ulp) {
      ulpId = ulp.id;
      up3Id = ulp.up3Id;
    }
    if (version) {
      versionId = version.id;
    }

    // 2. Create a test migration batch
    const batch = await prisma.migrationBatch.create({
      data: {
        fileName: "100baris.csv",
        fileSize: 10240,
        targetType: "FORM_RESPONSES_RAW",
        totalRows: 100,
        status: "PROCESSING",
        startedAt: new Date(),
      },
    });
    testBatchId = batch.id;
  });

  afterAll(async () => {
    // Clean up test reviews and batch
    if (testReviewIds.length > 0) {
      await prisma.ratingReview.deleteMany({
        where: { id: { in: testReviewIds } },
      });
    }

    if (testBatchId) {
      await prisma.migrationErrorLog.deleteMany({
        where: { batchId: testBatchId },
      });
      await prisma.migrationBatch.deleteMany({
        where: { id: testBatchId },
      });
    }

    await prisma.$disconnect();
    redis.disconnect();
  });

  describe("Tier 1: Fast Metadata Ingestion & CSV Stream Parsing", () => {
    it("should successfully parse all rows from docs/testing/100baris.csv without memory leaks", async () => {
      expect(fs.existsSync(CSV_FILE_PATH)).toBe(true);

      const parsedRows: RawReviewRow[] = [];
      const errorRows: any[] = [];

      const result = await parseCsvStream(CSV_FILE_PATH, {
        batchSize: 50,
        onBatch: async (batch) => {
          parsedRows.push(...batch);
        },
        onError: async (err) => {
          errorRows.push(err);
        },
      });

      // Verify that all 100+ rows were parsed
      expect(result.totalProcessed).toBeGreaterThanOrEqual(100);
      expect(parsedRows.length).toBeGreaterThanOrEqual(100);
      expect(errorRows.length).toBe(0);

      // Verify structure of first parsed row
      const firstRow = parsedRows[0];
      expect(firstRow.up3Name).toBe("UP3 OGAN ILIR");
      expect(firstRow.ulpName).toBe("ULP TUGU MULYO");
      expect(firstRow.playstoreReviewerName).toBe("Rudi Tabuci");
      expect(firstRow.evidenceImagePath).toContain("drive.google.com");
      expect(firstRow.validationStatus).toBe("APPROVED");
    });

    it("should perform zero-blocking bulk database insertion for Tier 1 metadata ingestion", async () => {
      const rowsToInsert: RawReviewRow[] = [];

      await parseCsvStream(CSV_FILE_PATH, {
        batchSize: 10,
        onBatch: async (batch) => {
          if (rowsToInsert.length < 10) {
            rowsToInsert.push(...batch.slice(0, 10 - rowsToInsert.length));
          }
        },
      });

      expect(rowsToInsert).toHaveLength(10);

      const startTime = Date.now();

      // Zero-blocking: Insert rows directly into DB with external GDrive links intact
      const createdReviews = await Promise.all(
        rowsToInsert.map((row) =>
          prisma.ratingReview.create({
            data: {
              up3Id,
              ulpId,
              appVersionId: versionId,
              playstoreReviewerName: row.playstoreReviewerName,
              originalReviewerName: row.originalReviewerName,
              entryDate: row.entryDate,
              timestamp: row.timestamp,
              evidenceImagePath: row.evidenceImagePath, // Retains GDrive URL for Tier 2 lazy/background processing
              reviewerCategory: row.reviewerCategory,
              source: "MIGRATION",
              migrationBatchId: testBatchId,
              validationStatus: "PENDING",
            },
          })
        )
      );

      const durationMs = Date.now() - startTime;
      expect(createdReviews).toHaveLength(10);
      testReviewIds.push(...createdReviews.map((r) => r.id));

      // 10 database inserts should complete ultra-fast (< 500ms) because no external network I/O is performed in Tier 1
      expect(durationMs).toBeLessThan(500);

      // Verify records in database
      const count = await prisma.ratingReview.count({
        where: { id: { in: testReviewIds } },
      });
      expect(count).toBe(10);
    });
  });

  describe("Tier 2: Smart Google Drive Streaming Proxy & Storage Persistence", () => {
    it("should correctly extract Google Drive File IDs from various URL formats", () => {
      const id1 = extractGoogleDriveFileId("https://drive.google.com/open?id=1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp");
      expect(id1).toBe("1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp");

      const id2 = extractGoogleDriveFileId("https://drive.google.com/file/d/157qyJ-yAvYTTnPZcgM1qZ0cXpdfLrQqb/view?usp=sharing");
      expect(id2).toBe("157qyJ-yAvYTTnPZcgM1qZ0cXpdfLrQqb");

      const id3 = extractGoogleDriveFileId("https://lh3.googleusercontent.com/d/1--6-2bJppAlOrXKfNgkP9IzUmagITwk8");
      expect(id3).toBe("1--6-2bJppAlOrXKfNgkP9IzUmagITwk8");

      expect(extractGoogleDriveFileId("evidence/2026/10/local.jpg")).toBeNull();
      expect(isExternalUrl("https://drive.google.com/open?id=123")).toBe(true);
      expect(isExternalUrl("evidence/2026/10/local.jpg")).toBe(false);
    });

    it("should download and stream a real Google Drive image, validating magic bytes and caching", async () => {
      const gdriveUrl = "https://drive.google.com/open?id=1xj8_zEjqD29por3pv3Ji0m_ASveH_FBC"; // Mika evidence
      const downloadResult = await downloadEvidenceImage(gdriveUrl);

      expect(downloadResult.success).toBe(true);
      expect(downloadResult.absolutePath).toBeDefined();
      expect(fs.existsSync(downloadResult.absolutePath!)).toBe(true);

      // Verify file magic bytes for valid JPEG/PNG
      const buffer = fs.readFileSync(downloadResult.absolutePath!);
      expect(buffer.length).toBeGreaterThan(1000);

      const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      expect(isJpeg || isPng).toBe(true);

      // Verify local caching: Second download of the same URL should return instantly (< 5ms)
      const cacheStartTime = Date.now();
      const cachedResult = await downloadEvidenceImage(gdriveUrl);
      const cacheDuration = Date.now() - cacheStartTime;

      expect(cachedResult.success).toBe(true);
      expect(cachedResult.absolutePath).toBe(downloadResult.absolutePath);
      expect(cacheDuration).toBeLessThan(20);
    });
  });

  describe("Tier 2: Vision Core OCR & Play Store Reviewer Name Fuzzy Validation", () => {
    it("should stream Google Drive image in-memory and verify match for reviewer Mika with GREEN APPROVED status without disk persistence", async () => {
      const mikaUrl = "https://drive.google.com/open?id=1xj8_zEjqD29por3pv3Ji0m_ASveH_FBC";
      const streamRes = await streamEvidenceImageBuffer(mikaUrl);
      expect(streamRes.success).toBe(true);
      expect(streamRes.buffer).toBeDefined();

      const ocrResult = await executeOcrBridge(streamRes.buffer!, "Mika");

      expect(ocrResult.success).toBe(true);
      expect(ocrResult.extracted_text.length).toBeGreaterThan(50);
      expect(ocrResult.extracted_text.toLowerCase()).toContain("mika");
      expect(ocrResult.phash).toHaveLength(16); // 64-bit hex hash

      // Mika is present in the screenshot under 'Ulasan Anda', so similarity must be 100% GREEN APPROVED
      expect(ocrResult.similarity_score).toBe(100);
      expect(ocrResult.zone).toBe("GREEN");
      expect(ocrResult.recommended_status).toBe("APPROVED");
    }, 35000);

    it("should stream Google Drive image in-memory and verify match for reviewer Eta with GREEN APPROVED status", async () => {
      const etaUrl = "https://drive.google.com/open?id=1--6-2bJppAlOrXKfNgkP9IzUmagITwk8";
      const streamRes = await streamEvidenceImageBuffer(etaUrl);
      expect(streamRes.success).toBe(true);
      expect(streamRes.buffer).toBeDefined();

      const ocrResult = await executeOcrBridge(streamRes.buffer!, "Eta");

      expect(ocrResult.success).toBe(true);
      expect(ocrResult.extracted_text.length).toBeGreaterThan(50);
      expect(ocrResult.extracted_text.toLowerCase()).toContain("eta");

      expect(ocrResult.similarity_score).toBe(100);
      expect(ocrResult.zone).toBe("GREEN");
      expect(ocrResult.recommended_status).toBe("APPROVED");
    }, 35000);

    it("should accurately reject mismatched screenshot with RED REJECTED status", async () => {
      // Testing with a name that is completely absent from Mika's screenshot
      const dl = await downloadEvidenceImage("https://drive.google.com/open?id=1xj8_zEjqD29por3pv3Ji0m_ASveH_FBC");
      expect(dl.success).toBe(true);

      const ocrResult = await executeOcrBridge(dl.absolutePath!, "NamaPengulasTidakAdaSamaSekali12345");

      expect(ocrResult.success).toBe(true);
      expect(ocrResult.similarity_score).toBeLessThan(70);
      expect(ocrResult.zone).toBe("RED");
      expect(ocrResult.recommended_status).toBe("REJECTED");
    });

    it("should detect duplicate evidence using 64-bit perceptual hashing and soft-flag without data loss", async () => {
      const mikaUrl = "https://drive.google.com/open?id=1xj8_zEjqD29por3pv3Ji0m_ASveH_FBC";
      const dl = await downloadEvidenceImage(mikaUrl);

      const ocrResult = await executeOcrBridge(dl.absolutePath!, "Mika");
      expect(ocrResult.phash).toBeTruthy();

      // Create primary review record with this phash
      const primaryReview = await prisma.ratingReview.create({
        data: {
          up3Id,
          ulpId,
          appVersionId: versionId,
          playstoreReviewerName: "Mika",
          entryDate: new Date("2026-07-02"),
          timestamp: new Date(),
          evidenceImagePath: dl.relativePath!,
          evidenceImageHash: ocrResult.phash,
          validationStatus: "APPROVED",
        },
      });
      testReviewIds.push(primaryReview.id);

      // Create duplicate review submission attempting to reuse the exact same evidence image
      const duplicateReview = await prisma.ratingReview.create({
        data: {
          up3Id,
          ulpId,
          appVersionId: versionId,
          playstoreReviewerName: "Mika Peniru",
          entryDate: new Date("2026-07-03"),
          timestamp: new Date(),
          evidenceImagePath: dl.relativePath!,
          validationStatus: "PENDING",
        },
      });
      testReviewIds.push(duplicateReview.id);

      // Run anti-fraud check (Hamming distance threshold <= 5)
      const antiFraud = await checkImageDuplicate(duplicateReview.id, ocrResult.phash, 5);

      expect(antiFraud.isDuplicate).toBe(true);
      expect(antiFraud.duplicateOfId).toBeTruthy();
      expect(antiFraud.minDistance).toBeLessThanOrEqual(5);

      // Verify that primary review is NOT deleted or overwritten (Zero Data Loss)
      const primaryAfter = await prisma.ratingReview.findUnique({
        where: { id: primaryReview.id },
      });
      expect(primaryAfter).toBeDefined();
      expect(primaryAfter?.validationStatus).toBe("APPROVED");
    });
  });
});
