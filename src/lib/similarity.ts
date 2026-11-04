/**
 * Multimodal Similarity and Comparison Utilities
 * Evaluates Visual pHash, OCR Extracted Text, and Reviewer Name similarities
 * between reviews to distinguish true duplicates from UI template collisions.
 */

// Common Indonesian Google Play Store UI template stopwords to exclude when comparing dynamic review text
export const PLAYSTORE_STOPWORDS = new Set([
  "pln",
  "mobile",
  "aplikasi",
  "ulasan",
  "anda",
  "yang",
  "baru",
  "terakhir",
  "diupdate",
  "energikan",
  "harimu",
  "dengan",
  "wajah",
  "tampilan",
  "lebih",
  "modern",
  "navigasi",
  "mudah",
  "digunakan",
  "edit",
  "dukungan",
  "ganti",
  "akun",
  "untuk",
  "menjadi",
  "penguji",
  "beta",
  "dikaitkan",
  "lain",
  "mendapatkan",
  "update",
  "dahulu",
  "play",
  "store",
  "gabung",
  "selengkapnya",
  "tentang",
  "sinergi",
  "layanan",
  "kepada",
  "pelanggan",
  "melalui",
  "berbasis",
  "gratis",
  "populer",
  "bisnis",
  "rumah",
  "griya",
  "penyedia",
  "utilitas",
  "dating",
  "game",
  "telusuri",
  "buku",
  "uninstal",
  "buka",
  "rating",
  "bintang",
  "versi",
]);

/**
 * Calculates the Hamming Distance (number of differing bits) between two 64-bit hexadecimal strings.
 * Distance ranges from 0 (identical) to 64 (completely different).
 */
export function calculateHammingDistance(hexA?: string | null, hexB?: string | null): number {
  if (!hexA || !hexB || hexA.length !== 16 || hexB.length !== 16) {
    return 64; // Max distance for invalid/mismatched lengths
  }

  try {
    const valA = BigInt("0x" + hexA);
    const valB = BigInt("0x" + hexB);
    let xorVal = valA ^ valB;

    let distance = 0;
    while (xorVal > 0n) {
      if (xorVal & 1n) distance++;
      xorVal >>= 1n;
    }
    return distance;
  } catch {
    return 64;
  }
}

/**
 * Calculates visual similarity percentage (0 - 100%) based on 64-bit pHash Hamming distance.
 */
export function calculateVisualSimilarity(hexA?: string | null, hexB?: string | null): number {
  if (!hexA || !hexB) return 0;
  const distance = calculateHammingDistance(hexA, hexB);
  return Math.max(0, Math.round((1 - distance / 64) * 100));
}

/**
 * Tokenizes text into normalized words of minimum length 3.
 */
export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Calculates OCR Text Similarity percentage (0 - 100%) by comparing non-template dynamic content words.
 * Uses Jaccard / Token-overlap metric after filtering out standard Google Play Store UI stopwords.
 */
export function calculateTextSimilarity(textA?: string | null, textB?: string | null): number {
  if (!textA || !textB) return 0;

  const rawTokensA = tokenizeText(textA);
  const rawTokensB = tokenizeText(textB);

  const tokensA = rawTokensA.filter((w) => !PLAYSTORE_STOPWORDS.has(w));
  const tokensB = rawTokensB.filter((w) => !PLAYSTORE_STOPWORDS.has(w));

  // Fallback to raw tokens if filtering stripped everything
  const setA = new Set(tokensA.length > 0 ? tokensA : rawTokensA);
  const setB = new Set(tokensB.length > 0 ? tokensB : rawTokensB);

  if (setA.size === 0 && setB.size === 0) return 100;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return Math.round((intersection / union) * 100);
}

/**
 * Calculates Reviewer Name Similarity percentage (0 - 100%) using Levenshtein distance.
 */
export function calculateReviewerSimilarity(nameA?: string | null, nameB?: string | null): number {
  const s1 = (nameA || "").trim().toLowerCase();
  const s2 = (nameB || "").trim().toLowerCase();

  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;

  const l1 = s1.length;
  const l2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= l1; i++) matrix[i] = [i];
  for (let j = 0; j <= l2; j++) matrix[0][j] = j;

  for (let i = 1; i <= l1; i++) {
    for (let j = 1; j <= l2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[l1][l2];
  const maxLen = Math.max(l1, l2);
  return Math.max(0, Math.round((1 - distance / maxLen) * 100));
}

