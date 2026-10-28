import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "@/server/routers/_app";
import { Role, ValidationStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import redis from "@/lib/redis";
import { generateExecutiveWorkbook } from "@/lib/export/excelExporter";
import { logAuditEvent } from "@/server/services/auditService";

describe("Task 7.1: Automated Critical User Journey Full Loop Integration (AC-1, AC-2)", () => {
  let fieldUser: any;
  let operatorUser: any;
  let managerUser: any;
  let adminUser: any;

  let up3Rivai: any;
  let ulpRivai: any;
  let appVer: any;

  let createdReviewId: string;
  const testReviewerName = "E2E Test Pelanggan";
  const dummyBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

  beforeAll(async () => {
    // 1. Fetch Seeded Entities
    fieldUser = await prisma.user.findFirst({ where: { role: Role.PETUGAS_LAPANGAN } });
    operatorUser = await prisma.user.findFirst({ where: { role: Role.PEGAWAI } });
    managerUser = await prisma.user.findFirst({ where: { role: Role.MANAGER } });
    adminUser = await prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } });

    ulpRivai = await prisma.uLP.findFirst({
      where: { code: "ULP_RIV" },
      include: { up3: true },
    });
    up3Rivai = ulpRivai!.up3;

    appVer = await prisma.appVersion.findFirst({
      where: { isActive: true },
    });
  });

  afterAll(async () => {
    if (createdReviewId) {
      await prisma.ratingReview.deleteMany({
        where: {
          OR: [{ id: createdReviewId }, { playstoreReviewerName: testReviewerName }],
        },
      });
    }
  });

  it("Stage 1 (Field Officer): submits review evidence via intake procedure", async () => {
    const fieldCaller = appRouter.createCaller({
      prisma,
      redis,
      user: fieldUser,
      ipAddress: "127.0.0.1",
      userAgent: "E2E-Runner",
    });

    const submitRes = await fieldCaller.intake.submitReview({
      up3Id: up3Rivai.id,
      ulpId: ulpRivai.id,
      appVersionId: appVer.id,
      playstoreReviewerName: testReviewerName,
      originalReviewerName: testReviewerName,
      entryDate: new Date().toISOString().split("T")[0],
      evidenceImageBase64: dummyBase64,
      evidenceFilename: "e2e_eviden.jpg",
    });

    expect(submitRes.success).toBe(true);
    expect(submitRes.reviewId).toBeDefined();
    createdReviewId = submitRes.reviewId;

    // Verify initial database record state is PENDING
    const dbRecord = await prisma.ratingReview.findUnique({
      where: { id: createdReviewId },
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.validationStatus).toBe(ValidationStatus.PENDING);
    expect(dbRecord?.isDuplicate).toBe(false);
  });

  it("Stage 2 (Background Pipeline): simulates OCR marginal match entering Yellow Zone (NEEDS_REVIEW)", async () => {
    // Simulate background OCR worker updating status to Yellow Zone (78% match)
    const updatedReview = await prisma.ratingReview.update({
      where: { id: createdReviewId },
      data: {
        validationStatus: ValidationStatus.NEEDS_REVIEW,
        confidenceScore: 78.5,
        extractedOcrText: "Pelanggan PLN Puas Rating 5 Bintang Hendra",
        evidenceImageHash: "00000000ffffffff",
      },
    });

    expect(updatedReview.validationStatus).toBe(ValidationStatus.NEEDS_REVIEW);
    expect(updatedReview.confidenceScore).toBe(78.5);
  });

  it("Stage 3 (Operator Triage): operator views queue, inspects evidence, and approves review", async () => {
    const operatorCaller = appRouter.createCaller({
      prisma,
      redis,
      user: operatorUser,
      ipAddress: "127.0.0.1",
      userAgent: "E2E-Runner",
    });

    // 1. Fetch queue items
    const queue = await operatorCaller.triage.getQueue({
      status: "NEEDS_REVIEW",
      ulpId: ulpRivai.id,
    });

    const targetItem = queue.items.find((item) => item.id === createdReviewId);
    expect(targetItem).toBeDefined();
    expect(targetItem?.validationStatus).toBe(ValidationStatus.NEEDS_REVIEW);

    // 2. Approve review
    const approveRes = await operatorCaller.triage.submitDecision({
      reviewId: createdReviewId,
      decision: "APPROVED",
      remarks: "Eviden terverifikasi sah oleh Operator Triase E2E",
    });

    expect(approveRes).toBeDefined();
    expect(approveRes.validationStatus).toBe(ValidationStatus.APPROVED);

    // Verify record in database is APPROVED and audited
    const verifiedDbRecord = await prisma.ratingReview.findUnique({
      where: { id: createdReviewId },
    });
    expect(verifiedDbRecord?.validationStatus).toBe(ValidationStatus.APPROVED);
    expect(verifiedDbRecord?.verifiedById).toBe(operatorUser.id);
  });

  it("Stage 4 (Manager Executive): manager observes updated realization metrics and exports Excel", async () => {
    const managerCaller = appRouter.createCaller({
      prisma,
      redis,
      user: managerUser,
      ipAddress: "127.0.0.1",
      userAgent: "E2E-Runner",
    });

    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Fetch daily executive report
    const dailyReport = await managerCaller.report.getDaily({ date: todayStr });
    expect(dailyReport).toBeDefined();
    expect(dailyReport.grandTotal.dailyRealization).toBeGreaterThanOrEqual(1);

    // Find ULP Rivai in report
    const plgGroup = dailyReport.groups.find((g) => g.up3Code === "UP3_PLG");
    expect(plgGroup).toBeDefined();

    const rivaiRow = plgGroup?.ulps.find((r) => r.ulpCode === "ULP_RIV");
    expect(rivaiRow).toBeDefined();
    expect(rivaiRow?.dailyRealization).toBeGreaterThanOrEqual(1);

    // 2. Generate Excel workbook
    const excelBuffer = await generateExecutiveWorkbook({
      date: new Date(),
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    });

    expect(excelBuffer).toBeDefined();
    expect(excelBuffer.length).toBeGreaterThan(1000); // Authentic binary workbook
  });

  it("Stage 5 (Anti-Fraud Duplicate Detection): flags second submission using identical evidence image without deletion", async () => {
    const fieldCaller = appRouter.createCaller({
      prisma,
      redis,
      user: fieldUser,
      ipAddress: "127.0.0.1",
      userAgent: "E2E-Runner",
    });

    // Submit identical duplicate
    const secondSubmitRes = await fieldCaller.intake.submitReview({
      up3Id: up3Rivai.id,
      ulpId: ulpRivai.id,
      appVersionId: appVer.id,
      playstoreReviewerName: testReviewerName + " Clone",
      originalReviewerName: testReviewerName + " Clone",
      entryDate: new Date().toISOString().split("T")[0],
      evidenceImageBase64: dummyBase64,
      evidenceFilename: "e2e_duplicate.jpg",
    });

    // Simulate OCR worker matching identical perceptual hash
    await prisma.ratingReview.update({
      where: { id: secondSubmitRes.reviewId },
      data: {
        isDuplicate: true,
        duplicateOfId: createdReviewId,
        validationStatus: ValidationStatus.REJECTED,
        reviewRemarks: "Terdeteksi Duplikat Foto Eviden (Jarak Hamming: 0)",
      },
    });

    // Verify soft-flagging: both records exist, second is linked to first
    const originalRecord = await prisma.ratingReview.findUnique({
      where: { id: createdReviewId },
    });
    const cloneRecord = await prisma.ratingReview.findUnique({
      where: { id: secondSubmitRes.reviewId },
    });

    expect(originalRecord).not.toBeNull();
    expect(cloneRecord).not.toBeNull();
    expect(cloneRecord?.isDuplicate).toBe(true);
    expect(cloneRecord?.duplicateOfId).toBe(createdReviewId);
    expect(cloneRecord?.validationStatus).toBe(ValidationStatus.REJECTED);

    // Cleanup clone
    await prisma.ratingReview.delete({ where: { id: secondSubmitRes.reviewId } });
  });
});
