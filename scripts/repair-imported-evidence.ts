import prisma from "@/lib/prisma";
import { BASE_UPLOAD_DIR, storeEvidenceImage, type EvidenceImageType } from "@/lib/storage";
import { streamExternalEvidence } from "@/server/services/evidenceAcquisition";
import { enqueueEvidenceVerification } from "@/server/services/evidenceVerification";

async function repairImportedEvidence() {
  console.log("🔍 Scanning for RatingReview records with external evidenceImagePath (e.g. Google Drive)...");

  const unlinkedReviews = await prisma.ratingReview.findMany({
    where: {
      OR: [
        { evidenceImagePath: { startsWith: "http://" } },
        { evidenceImagePath: { startsWith: "https://" } },
      ],
    },
    select: {
      id: true,
      playstoreReviewerName: true,
      evidenceImagePath: true,
      entryDate: true,
      validationStatus: true,
    },
  });

  console.log(`Found ${unlinkedReviews.length} record(s) requiring evidence image repair.`);

  let repairedCount = 0;
  let failedCount = 0;

  for (const review of unlinkedReviews) {
    console.log(`\nProcessing review ID: ${review.id} (${review.playstoreReviewerName})`);
    console.log(`Current external URL: ${review.evidenceImagePath}`);

    try {
      const streamResult = await streamExternalEvidence(review.evidenceImagePath);

      if (streamResult.success && streamResult.buffer) {
        const imageType = (streamResult.mimeType || "image/jpeg") as EvidenceImageType;
        const savedPath = await storeEvidenceImage(
          BASE_UPLOAD_DIR,
          streamResult.buffer,
          imageType,
          review.entryDate.toISOString().slice(0, 10)
        );

        console.log(`✅ Saved locally to: ${savedPath}`);

        await prisma.ratingReview.update({
          where: { id: review.id },
          data: {
            evidenceImagePath: savedPath,
          },
        });

        const enqueued = await enqueueEvidenceVerification(
          {
            reviewId: review.id,
            evidenceImagePath: savedPath,
            expectedReviewerName: review.playstoreReviewerName,
          },
          { priority: 2 }
        );

        console.log(`🚀 Dispatched to OCR Queue (Job ID: ${enqueued.jobIds[0] || "queued"})`);
        repairedCount++;
      } else {
        console.error(`❌ Failed to acquire: ${streamResult.error}`);
        await prisma.ratingReview.update({
          where: { id: review.id },
          data: {
            validationStatus: "NEEDS_REVIEW",
            reviewRemarks: "Tautan eviden Google Drive eksternal tidak dapat diakses secara otomatis",
          },
        });
        failedCount++;
      }
    } catch (err: any) {
      console.error(`❌ Unexpected error repairing review ${review.id}:`, err.message);
      failedCount++;
    }
  }

  console.log(`\n🎉 Repair summary: ${repairedCount} repaired & enqueued, ${failedCount} failed.`);
}

repairImportedEvidence()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    setTimeout(() => process.exit(0), 1000);
  });
