import prisma from "@/lib/prisma";

/**
 * Calculates the Hamming Distance (number of differing bits) between two 64-bit hexadecimal strings.
 */
export function calculateHammingDistance(hexA: string, hexB: string): number {
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
  } catch (err) {
    return 64;
  }
}

export interface AntiFraudCheckResult {
  isDuplicate: boolean;
  duplicateOfId: string | null;
  minDistance: number;
}

/**
 * Checks if the given 64-bit perceptual hash is a duplicate of any existing review in the database.
 * Uses a Hamming distance threshold of <= 5 (visual duplicate detection).
 */
export async function checkImageDuplicate(
  reviewId: string,
  imageHash: string,
  threshold: number = 5
): Promise<AntiFraudCheckResult> {
  if (!imageHash || imageHash.length !== 16) {
    return { isDuplicate: false, duplicateOfId: null, minDistance: 64 };
  }

  // 1. Fast exact-match check (Hamming distance == 0)
  const exactMatch = await prisma.ratingReview.findFirst({
    where: {
      evidenceImageHash: imageHash,
      id: { not: reviewId },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (exactMatch) {
    return {
      isDuplicate: true,
      duplicateOfId: exactMatch.id,
      minDistance: 0,
    };
  }

  // 2. Near-duplicate check: fetch recent reviews with hashes to check Hamming distance <= threshold
  const candidates = await prisma.ratingReview.findMany({
    where: {
      evidenceImageHash: { not: null },
      id: { not: reviewId },
    },
    select: { id: true, evidenceImageHash: true },
    take: 1000,
    orderBy: { createdAt: "desc" },
  });

  let closestMatchId: string | null = null;
  let minDistance = 64;

  for (const candidate of candidates) {
    if (!candidate.evidenceImageHash) continue;
    const distance = calculateHammingDistance(imageHash, candidate.evidenceImageHash);
    if (distance < minDistance) {
      minDistance = distance;
      closestMatchId = candidate.id;
    }
    if (distance <= threshold) {
      return {
        isDuplicate: true,
        duplicateOfId: candidate.id,
        minDistance: distance,
      };
    }
  }

  return {
    isDuplicate: false,
    duplicateOfId: null,
    minDistance,
  };
}
