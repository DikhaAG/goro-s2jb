import { describe, it, expect } from "vitest";
import {
  calculateHammingDistance,
  calculateVisualSimilarity,
  tokenizeText,
  calculateTextSimilarity,
  calculateReviewerSimilarity,
} from "@/lib/similarity";

describe("Multimodal Similarity Utilities", () => {
  describe("calculateHammingDistance & calculateVisualSimilarity", () => {
    it("returns 0 distance and 100% similarity for identical hashes", () => {
      const hash = "8ecd433b9191b1b9";
      expect(calculateHammingDistance(hash, hash)).toBe(0);
      expect(calculateVisualSimilarity(hash, hash)).toBe(100);
    });

    it("returns 64 distance and 0% similarity for inverted 64-bit hashes", () => {
      const hashA = "0000000000000000";
      const hashB = "ffffffffffffffff";
      expect(calculateHammingDistance(hashA, hashB)).toBe(64);
      expect(calculateVisualSimilarity(hashA, hashB)).toBe(0);
    });

    it("handles null or undefined or mismatched lengths gracefully", () => {
      expect(calculateHammingDistance(null, "8ecd433b9191b1b9")).toBe(64);
      expect(calculateVisualSimilarity(null, null)).toBe(0);
      expect(calculateHammingDistance("short", "8ecd433b9191b1b9")).toBe(64);
    });
  });

  describe("tokenizeText & calculateTextSimilarity", () => {
    it("tokenizes and cleans words", () => {
      const tokens = tokenizeText("PLN Mobile sangat membantu saat diluar kota!");
      expect(tokens).toContain("mobile");
      expect(tokens).toContain("sangat");
      expect(tokens).toContain("membantu");
      expect(tokens).toContain("kota");
    });

    it("filters standard Play Store template stopwords to isolate unique review text", () => {
      const text1 = "pln mobile sangat membantu saat saya sedang diluar kota";
      const text2 = "fitur pln mobile semakin lengkap dan memudahkan pembelian token";
      const sim = calculateTextSimilarity(text1, text2);
      expect(sim).toBeLessThan(60);
    });

    it("returns 100% similarity for identical review texts", () => {
      const text = "Aplikasi sangat bagus dan responsif sekali";
      expect(calculateTextSimilarity(text, text)).toBe(100);
    });
  });

  describe("calculateReviewerSimilarity", () => {
    it("correctly calculates similarity between different reviewer names", () => {
      // cella adinda vs cia marsha
      const sim = calculateReviewerSimilarity("cella adinda", "cia marsha");
      expect(sim).toBeLessThan(50);
    });

    it("returns 100% for identical names ignoring case and whitespace", () => {
      expect(calculateReviewerSimilarity("  Budi Santoso ", "budi santoso")).toBe(100);
    });

    it("returns high score for minor typos", () => {
      expect(calculateReviewerSimilarity("Ahmad Fauzi", "Achmad Fauzi")).toBeGreaterThanOrEqual(80);
    });
  });
});

