/**
 * Pure math utilities for the recommendation engine.
 * No external dependencies — safe to import in tests without DB/env setup.
 */

/**
 * Compute Pearson correlation coefficient between two rating vectors.
 * Returns a value between -1 and 1 (1 = identical taste, -1 = opposite).
 * Requires both arrays to be the same length and represent scores on shared media.
 * Returns 0 if fewer than 3 items (insufficient data).
 */
export function pearsonCorrelation(ratingsA: number[], ratingsB: number[]): number {
  const n = ratingsA.length;
  if (n < 3) return 0;

  let sumA = 0;
  let sumB = 0;
  let sumAB = 0;
  let sumA2 = 0;
  let sumB2 = 0;

  for (let index = 0; index < n; index++) {
    const a = ratingsA[index] ?? 0;
    const b = ratingsB[index] ?? 0;
    sumA += a;
    sumB += b;
    sumAB += a * b;
    sumA2 += a * a;
    sumB2 += b * b;
  }

  const numerator = n * sumAB - sumA * sumB;
  const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));

  if (denominator === 0) return 0;
  return numerator / denominator;
}
