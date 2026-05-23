/**
 * Derive a one-line user tagline from precomputed stats.
 *
 * Pure function — no I/O, no Date.now(), no db imports. All time-sensitive
 * fields (daysSinceJoined, recentStreak window) are precomputed by the caller.
 *
 * The order of BRANCHES below IS the priority chain. First match wins.
 * Reading top-to-bottom tells you exactly why a given user got their tagline.
 */

export interface TaglineInputs {
  ratingsGiven: number;
  /** One-decimal average across all of the user's ratings, or null if none. */
  avgScore: number | null;
  sessionsAttended: number;
  pickCount: number;
  /** Lifetime watch_sessions count across the whole group. */
  totalSessionsGlobal: number;
  /** Share by session count, summing to ≤ 1.0. Null when user has no sessions. */
  mediaTypeBreakdown: {
    movie: number;
    tv: number;
    anime: number;
  } | null;
  /** Top genre by lifetime watch count. Null when not computed (list endpoint). */
  topGenre: { name: string; count: number } | null;
  /** Dominant genre in the last N sessions. Null when not computed (list endpoint). */
  recentStreak: { genre: string; hits: number; window: number } | null;
  daysSinceJoined: number;
}

type Branch = (inputs: TaglineInputs) => string | null;

const RATING_MIN_SAMPLE = 5;
const RATING_GENEROUS_FLOOR = 8;
const RATING_TOUGH_CEILING = 6;
const GENRE_DEVOTEE_MIN_COUNT = 5;
const STREAK_MIN_HITS = 5;
const PICKER_MIN_COUNT = 3;
const MEDIA_LEAN_THRESHOLD = 0.6;
const NEW_USER_MAX_DAYS = 30;

const recentStreakBranch: Branch = ({ recentStreak }) => {
  if (recentStreak === null) return null;
  if (recentStreak.hits < STREAK_MIN_HITS) return null;
  if (recentStreak.hits * 2 <= recentStreak.window) return null;
  return `On a ${formatGenreLower(recentStreak.genre)} streak. ${String(recentStreak.hits)} of the last ${String(recentStreak.window)}.`;
};

const genreDevoteeBranch: Branch = ({ topGenre, sessionsAttended, avgScore }) => {
  if (topGenre === null) return null;
  if (topGenre.count < GENRE_DEVOTEE_MIN_COUNT) return null;
  return `${formatGenreTitle(topGenre.name)} devotee. ${statTail(sessionsAttended, avgScore)}`;
};

const pickerTendencyBranch: Branch = ({ pickCount, totalSessionsGlobal, mediaTypeBreakdown }) => {
  if (pickCount < PICKER_MIN_COUNT) return null;
  if (totalSessionsGlobal <= 0) return null;
  const lean = mediaLeanLabel(mediaTypeBreakdown);
  const head = `Picked ${String(pickCount)} of the last ${String(totalSessionsGlobal)} nights.`;
  return lean === null ? head : `${head} Mostly ${lean}.`;
};

const ratingPersonalityBranch: Branch = ({ avgScore, ratingsGiven }) => {
  if (avgScore === null) return null;
  if (ratingsGiven < RATING_MIN_SAMPLE) return null;
  const rounded = roundOneDecimal(avgScore);
  const formatted = rounded.toFixed(1);
  if (rounded >= RATING_GENEROUS_FLOOR) return `Generous rater. Averages ${formatted}.`;
  if (rounded <= RATING_TOUGH_CEILING) return `Tough crowd. Averages ${formatted}.`;
  return `Steady rater. Averages ${formatted}.`;
};

const mediaLeanBranch: Branch = ({ mediaTypeBreakdown }) => {
  const lean = mediaLeanLabel(mediaTypeBreakdown);
  if (lean === null) return null;
  const dominant = dominantShare(mediaTypeBreakdown);
  if (dominant === null) return null;
  const percent = Math.round(dominant * 100);
  return `Mostly ${lean}. ${String(percent)}% by session.`;
};

const newUserBranch: Branch = ({ daysSinceJoined, sessionsAttended, ratingsGiven }) => {
  if (daysSinceJoined > NEW_USER_MAX_DAYS) return null;
  if (sessionsAttended > 0 || ratingsGiven > 0) return null;
  return "Just joined. No ratings yet.";
};

const fallbackBranch: Branch = () => "Watching along.";

const BRANCHES: readonly Branch[] = [
  recentStreakBranch,
  genreDevoteeBranch,
  pickerTendencyBranch,
  ratingPersonalityBranch,
  mediaLeanBranch,
  newUserBranch,
  fallbackBranch,
];

export function deriveTagline(inputs: TaglineInputs): string {
  for (const branch of BRANCHES) {
    const line = branch(inputs);
    if (line !== null) return line;
  }
  return "Watching along.";
}

function statTail(watched: number, avgScore: number | null): string {
  if (avgScore === null) return `${String(watched)} watched.`;
  return `${String(watched)} watched, ${roundOneDecimal(avgScore).toFixed(1)} avg.`;
}

function mediaLeanLabel(
  breakdown: TaglineInputs["mediaTypeBreakdown"],
): "movies" | "tv" | "anime" | null {
  if (breakdown === null) return null;
  if (breakdown.movie >= MEDIA_LEAN_THRESHOLD) return "movies";
  if (breakdown.tv >= MEDIA_LEAN_THRESHOLD) return "tv";
  if (breakdown.anime >= MEDIA_LEAN_THRESHOLD) return "anime";
  return null;
}

function dominantShare(breakdown: TaglineInputs["mediaTypeBreakdown"]): number | null {
  if (breakdown === null) return null;
  const max = Math.max(breakdown.movie, breakdown.tv, breakdown.anime);
  return max >= MEDIA_LEAN_THRESHOLD ? max : null;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Title-case for the leading position in a sentence: "sci-fi" → "Sci-fi". */
function formatGenreTitle(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/** Lowercase form for use mid-sentence: "Sci-Fi" → "sci-fi". */
function formatGenreLower(raw: string): string {
  return raw.trim().toLowerCase();
}
