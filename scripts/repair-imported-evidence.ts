import prisma from "@/lib/prisma";
import { downloadEvidenceImage, isExternalUrl } from "@/server/services/evidenceDownloader";
import { ocrQueue } from "@/server/queues/ocrQueue";

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
      const dlResult = await downloadEvidenceImage(review.evidenceImagePath, review.entryDate);

      if (dlResult.success && dlResult.relativePath) {
        console.log(`✅ Downloaded successfully to local path: ${dlResult.relativePath}`);

        // Update database with local path
        await prisma.ratingReview.update({
          where: { id: review.id },
          data: {
            evidenceImagePath: dlResult.relativePath,
          },
        });

        // Enqueue to OCR queue for pHash and text extraction
        const job = await ocrQueue.add(
          "process-ocr",
          {
            reviewId: review.id,
            evidenceImagePath: dlResult.relativePath,
            expectedReviewerName: review.playstoreReviewerName,
          },
          {
            priority: 2,
          }
        );

        console.log(`🚀 Dispatched to OCR Queue (Job ID: ${job.id})`);
        repairedCount++;
      } else {
        console.error(`❌ Failed to download: ${dlResult.error}`);
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
    // Do not force process.exit immediately so queue jobs flush
    setTimeout(() => process.exit(0), 1000);
  });
