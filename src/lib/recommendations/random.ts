/**
 * Randomness utilities for recommendation variety
 *
 * These functions introduce controlled randomness so that refreshing
 * recommendations produces noticeably different results each time.
 * Using Math.random is intentional — cryptographic security is not needed
 * for recommendation shuffling, only non-determinism.
 */

/* eslint-disable sonarjs/pseudo-random */

/**
 * Pick a random TMDB discover page (1–maxPage).
 * TMDB discover returns up to 500 pages, but quality drops after ~5.
 */
export function randomPage(maxPage = 5): string {
  return String(Math.floor(Math.random() * maxPage) + 1);
}

/**
 * Randomly sample `count` items from an array.
 * If the array is shorter than `count`, returns the full array (shuffled).
 */
export function randomSample<T>(items: T[], count: number): T[] {
  if (items.length <= count) return shuffle(items);
  const shuffled = shuffle(items);
  return shuffled.slice(0, count);
}

/**
 * Fisher-Yates shuffle (returns a new array).
 */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temporary = result[index];
    result[index] = result[swapIndex] as T;
    result[swapIndex] = temporary as T;
  }
  return result;
}

/**
 * Add score jitter to recommendation items for ordering variety.
 * Jitter is ±maxJitter (default 0.03), keeping scores in [0, 1].
 */
export function addScoreJitter<T extends { score: number }>(items: T[], maxJitter = 0.03): T[] {
  return items.map((item) => ({
    ...item,
    score: Math.max(0, Math.min(1, item.score + (Math.random() * 2 - 1) * maxJitter)),
  }));
}
