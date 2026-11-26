import { OcrResultPayload, ValidationStatus } from "@/types";
import {
  AntiFraudCheckResult,
  BatchDuplicateQuery,
  VisionEnginePort,
} from "./types";
import { evaluateLocalDuplicates } from "./classification";

export interface InMemoryVisionEngineOptions {
  ocrResult?:
    | OcrResultPayload
    | ((imageInput: string | Buffer, expectedReviewerName: string) => OcrResultPayload | Promise<OcrResultPayload>);
  duplicateResult?:
    | AntiFraudCheckResult
    | ((query: BatchDuplicateQuery) => AntiFraudCheckResult | Promise<AntiFraudCheckResult>);
}

const DEFAULT_OCR_RESULT: OcrResultPayload = {
  success: true,
  extracted_text: "ULASAN BINTANG LIMA",
  phash: "1010101010101010",
  similarity_score: 95,
  zone: "GREEN",
  recommended_status: ValidationStatus.APPROVED,
  execution_time_ms: 10,
};

/**
 * In-memory VisionEnginePort adapter for fast, isolated unit tests at the module interface.
 */
export function createInMemoryVisionEngineAdapter(
  options: InMemoryVisionEngineOptions = {}
): VisionEnginePort {
  return {
    async extractAndMatch(imageInput, expectedReviewerName) {
      if (typeof options.ocrResult === "function") {
        return options.ocrResult(imageInput, expectedReviewerName);
      }
      return options.ocrResult ?? DEFAULT_OCR_RESULT;
    },

    async checkBatchDuplicates(query) {
      if (typeof options.duplicateResult === "function") {
        return options.duplicateResult(query);
      }
      if (options.duplicateResult) {
        return options.duplicateResult;
      }
      return evaluateLocalDuplicates(query);
    },
  };
}
