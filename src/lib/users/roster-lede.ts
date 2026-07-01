/**
 * Builds the editorial lede under "The cast" header on the roster page.
 *
 * Real-data version of the kit's mock ("Five regulars, one Sunday slot, 23
 * weeks in."). Two live inputs: the group size and the whole weeks since the
 * first logged session (`weeksSinceFirstSession` from `/api/stats`, the same
 * value driving the Database masthead's "N weeks in" footnote). Pure so it can
 * be unit-tested without the DB.
 */

const EVERGREEN_FALLBACK = "Everyone who shows up for the group's screening room.";

interface RosterLedeInputs {
  /** Number of registered members in the group. */
  readonly memberCount: number;
  /** Whole weeks since the group's first session; null before any is logged. */
  readonly weeksActive: number | null;
}

export function buildRosterLede({ memberCount, weeksActive }: RosterLedeInputs): string {
  // No members yet means no real numbers to lead with — keep the evergreen line.
  if (memberCount <= 0) {
    return EVERGREEN_FALLBACK;
  }

  const regulars = `${String(memberCount)} ${memberCount === 1 ? "regular" : "regulars"}`;

  if (weeksActive === null) {
    return `${regulars}, one Sunday slot.`;
  }

  const weeks = `${String(weeksActive)} ${weeksActive === 1 ? "week" : "weeks"} in`;
  return `${regulars} · ${weeks}, one Sunday slot.`;
}
