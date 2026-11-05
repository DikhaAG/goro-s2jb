import { executeOcrBridge } from "./ocrBridge";
import { OcrResultPayload } from "@/types";

/**
 * High-performance OCR extraction and triage evaluation.
 * Utilizes the Rust Native Engine via HTTP microservice or CLI binary fallback.
 */
export async function processEvidenceOcr(
  imageAbsolutePath: string,
  expectedReviewerName: string
): Promise<OcrResultPayload> {
  return executeOcrBridge(imageAbsolutePath, expectedReviewerName);
}
