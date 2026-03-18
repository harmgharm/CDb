/**
 * Game scoring calculations
 *
 * Score is based on how quickly the player guesses correctly.
 * Total reveal window: 10s reveal + 5s grace = 15,000ms.
 * Max score: 1000pts (instant guess), min score: 100pts (last moment).
 * Wrong guesses score 0pts. Streak bonus rewards consecutive correct rounds.
 */

const TOTAL_WINDOW_MS = 15_000;
const MAX_SCORE = 1000;
const MIN_SCORE = 100;
const SCORE_RANGE = MAX_SCORE - MIN_SCORE;
const STREAK_BONUS_PER_ROUND = 50;

/** Bonus awarded to the first correct guesser in a multiplayer round */
export const FIRST_CORRECT_BONUS = 200;

/** Grace period (ms) after first correct guess before auto-advancing */
export const COUNTDOWN_DURATION_MS = 5000;

/**
 * Calculate score for a correct guess based on response time.
 * Returns 0 for times beyond the window.
 */
export function calculateRoundScore(timeFromStartMs: number): number {
  if (timeFromStartMs < 0) return MAX_SCORE;
  if (timeFromStartMs > TOTAL_WINDOW_MS) return 0;

  const fraction = timeFromStartMs / TOTAL_WINDOW_MS;
  return Math.max(MIN_SCORE, MAX_SCORE - Math.floor(fraction * SCORE_RANGE));
}

/**
 * Calculate streak bonus for consecutive correct answers.
 * Streak of 0 or 1 gives no bonus — bonus starts at 2+.
 */
export function calculateStreakBonus(currentStreak: number): number {
  if (currentStreak < 2) return 0;
  return currentStreak * STREAK_BONUS_PER_ROUND;
}
