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

/** True with the given probability — for occasional strategy switches. */
export function chance(probability: number): boolean {
  return Math.random() < probability;
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
 * Weight-biased random ordering (Efraimidis–Spirakis): each item gets the key
 * random^(1/weight) and items sort by key descending, so higher weights tend
 * to land earlier without ever being guaranteed a spot. Used to serve cached
 * recommendation pools in a fresh order per request.
 */
export function weightedShuffle<T>(items: readonly T[], weightOf: (item: T) => number): T[] {
  return items
    .map((item) => ({ item, key: Math.random() ** (1 / Math.max(weightOf(item), 0.01)) }))
    .toSorted((a, b) => b.key - a.key)
    .map((entry) => entry.item);
}

/**
 * Score-biased random sample without replacement. Unlike randomSample, the
 * result order favors high scores, so slicing the front of it still reads as
 * "the good stuff" while varying between calls.
 */
export function weightedSampleByScore<T extends { score: number }>(
  items: readonly T[],
  count: number,
): T[] {
  return weightedShuffle(items, (item) => item.score).slice(0, count);
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
