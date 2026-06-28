/**
 * Jikan v4 API Client (MyAnimeList unofficial)
 *
 * Rate limit: 3 req/sec hard cap, 60 req/min.
 * No auth required.
 */

import type {
  JikanAnimeDetailResponse,
  JikanRecommendationsResponse,
  JikanSearchResponse,
} from "@/types/jikan";

const BASE_URL = "https://api.jikan.moe/v4";

/** Simple delay to respect Jikan rate limits */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 350; // ~3 req/sec

/**
 * Hard cap on a single Jikan request. Jikan is a free community API that
 * intermittently hangs toward a 504; without this, a slow request holds the
 * whole unified search (collectSearchResults awaits every source) for the full
 * upstream gateway timeout. Aborting turns a hang into a normal source failure
 * that the search isolates, so TMDB results still come back promptly.
 *
 * Tighter than TMDB's cap (4s vs 8s): Jikan is the flaky source and, when it
 * fails, almost always hangs hard rather than answering slowly — so a 4s cut-off
 * mostly trims dead-Jikan waits, not real results. The cap covers only the fetch,
 * not the up-to-350ms throttle wait that precedes it, so the true worst case is
 * ~4.35s; a healthy Jikan search lands under 4s, so genuine anime results survive.
 */
const REQUEST_TIMEOUT_MS = 4000;

async function jikanFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  // Throttle requests
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => {
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed);
    });
  }
  lastRequestTime = Date.now();

  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Jikan API error: ${response.status.toString()} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function searchAnime(query: string, page = 1): Promise<JikanSearchResponse> {
  return jikanFetch("/anime", {
    q: query,
    page: page.toString(),
    limit: "20",
    sfw: "true",
  });
}

export async function getAnimeDetails(malId: number): Promise<JikanAnimeDetailResponse> {
  return jikanFetch(`/anime/${malId.toString()}`);
}

export async function getAnimeRecommendations(
  malId: number,
): Promise<JikanRecommendationsResponse> {
  return jikanFetch(`/anime/${malId.toString()}/recommendations`);
}

export async function discoverAnime(params: Record<string, string>): Promise<JikanSearchResponse> {
  return jikanFetch<JikanSearchResponse>("/anime", {
    sfw: "true",
    limit: "20",
    ...params,
  });
}
