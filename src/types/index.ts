import { Role, ValidationStatus } from "@prisma/client";

export { Role, ValidationStatus };

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  up3Id?: string | null;
  ulpId?: string | null;
}

export type OcrZone = "GREEN" | "YELLOW" | "RED";

export interface OcrResultPayload {
  success: boolean;
  extracted_text: string;
  phash: string;
  similarity_score: number;
  zone: OcrZone;
  recommended_status: ValidationStatus;
  execution_time_ms?: number;
  error?: string;
}

export interface ReviewSubmissionPayload {
  up3Id: string;
  ulpId: string;
  playstoreReviewerName: string;
  entryDate: string;
  appVersionId: string;
  originalReviewerName: string;
  reviewerCategory?: string;
  fieldNotes?: string;
}
