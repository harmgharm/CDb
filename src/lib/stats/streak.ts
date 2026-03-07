/**
 * Pure streak computation logic — no DB dependency.
 *
 * A "streak" is consecutive days with at least one watch session.
 * Grace period: if day N ends with a late session (≥22:00) and day N+2
 * starts with an early session (≤02:00), they count as consecutive
 * (the "26-hour rule" for late-night viewing that spills past midnight).
 */

export interface SessionDay {
  /** ISO date string (YYYY-MM-DD) */
  readonly date: string;
  /** Earliest session time on this day (HH:MM or HH:MM:SS), or null */
  readonly earliestTime: string | null;
  /** Latest session time on this day (HH:MM or HH:MM:SS), or null */
  readonly latestTime: string | null;
}

export interface StreakResult {
  longest: number;
  current: number;
}

/** Parse HH:MM or HH:MM:SS to minutes since midnight */
function parseTimeToMinutes(time: string): number {
  const [hoursString = "0", minutesString = "0"] = time.split(":");
  return Number(hoursString) * 60 + Number(minutesString);
}

/** Check if a time is late evening (≥22:00 / 10pm) */
function isLateTime(time: string | null): boolean {
  if (time === null) return false;
  return parseTimeToMinutes(time) >= 22 * 60;
}

/** Check if a time is early morning (≤02:00 / 2am) */
function isEarlyTime(time: string | null): boolean {
  if (time === null) return false;
  return parseTimeToMinutes(time) <= 2 * 60;
}

/** Difference in calendar days between two ISO date strings */
function diffInDays(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

/**
 * Check if two session days are "consecutive" for streak purposes.
 * - 1 calendar day apart = always consecutive
 * - 2 calendar days apart = consecutive if prev had late session AND curr had early session
 */
function areConsecutive(previous: SessionDay, current: SessionDay): boolean {
  const gap = diffInDays(current.date, previous.date);

  if (gap === 1) return true;
  if (gap === 2) return isLateTime(previous.latestTime) && isEarlyTime(current.earliestTime);
  return false;
}

/**
 * Compute longest and current watch streaks from an ordered list of session days.
 *
 * @param sessions - Must be sorted by date ascending, with no duplicate dates
 * @param today - ISO date string for "today" (for current streak calculation)
 */
export function computeStreaks(sessions: readonly SessionDay[], today: string): StreakResult {
  if (sessions.length === 0) return { longest: 0, current: 0 };

  let longest = 1;
  let currentRun = 1;

  for (let index = 1; index < sessions.length; index++) {
    const previous = sessions[index - 1];
    const current = sessions[index];
    const consecutive =
      previous !== undefined && current !== undefined && areConsecutive(previous, current);

    currentRun = consecutive ? currentRun + 1 : 1;
    longest = Math.max(longest, currentRun);
  }

  // Current streak: check if the last session day is "today" or "yesterday" (with grace period)
  const lastSession = sessions.at(-1);
  if (lastSession === undefined) return { longest: 0, current: 0 };

  const daysSinceLast = diffInDays(today, lastSession.date);
  const isStreakActive =
    daysSinceLast === 0 ||
    daysSinceLast === 1 ||
    (daysSinceLast === 2 && isLateTime(lastSession.latestTime));

  return {
    longest,
    current: isStreakActive ? currentRun : 0,
  };
}
