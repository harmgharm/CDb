/**
 * Jikan v4 API Client (MyAnimeList unofficial)
 *
 * Rate limit: 3 req/sec hard cap, 60 req/min.
 * No auth required.
 */

import type { JikanAnimeDetailResponse, JikanSearchResponse } from "@/types/jikan";

const BASE_URL = "https://api.jikan.moe/v4";

/** Simple delay to respect Jikan rate limits */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 350; // ~3 req/sec

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

  const response = await fetch(url.toString());

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
