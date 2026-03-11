/**
 * GET /api/media/preview
 *
 * Fetches detailed metadata for a single external media item (TMDB or Jikan).
 * Used by the media preview dialog to show runtime, director, creator, etc.
 */

import { getAnimeDetails } from "@/lib/api/jikan";
import { errorResponse, successResponse } from "@/lib/api/response";
import { getMovieCredits, getMovieDetails, getTvDetails } from "@/lib/api/tmdb";
import { requireAuth } from "@/lib/auth";
import type { MediaPreviewDetail } from "@/types/media";

function extractDirector(credits: { crew: { job: string; name: string }[] }): string | null {
  const director = credits.crew.find((c) => c.job === "Director");
  return director?.name ?? null;
}

async function fetchMoviePreview(tmdbId: number): Promise<MediaPreviewDetail> {
  const [details, credits] = await Promise.all([getMovieDetails(tmdbId), getMovieCredits(tmdbId)]);

  return {
    runtime: details.runtime,
    episodeCount: null,
    seasonCount: null,
    director: extractDirector(credits),
    creator: null,
    studios: details.production_companies.map((c) => c.name),
    status: details.status,
    tagline: details.tagline.length > 0 ? details.tagline : null,
  };
}

async function fetchTvPreview(tmdbId: number): Promise<MediaPreviewDetail> {
  const details = await getTvDetails(tmdbId);

  return {
    runtime: details.episode_run_time.length > 0 ? (details.episode_run_time[0] ?? null) : null,
    episodeCount: details.number_of_episodes,
    seasonCount: details.number_of_seasons,
    director: null,
    creator:
      details.created_by.length > 0 ? details.created_by.map((c) => c.name).join(", ") : null,
    studios: details.production_companies.map((c) => c.name),
    status: details.status,
    tagline: details.tagline.length > 0 ? details.tagline : null,
  };
}

async function fetchAnimePreview(malId: number): Promise<MediaPreviewDetail> {
  const { data: anime } = await getAnimeDetails(malId);

  return {
    runtime: null,
    episodeCount: anime.episodes,
    seasonCount: null,
    director: null,
    creator: null,
    studios: anime.studios.map((s) => s.name),
    status: anime.status,
    tagline: null,
  };
}

export async function GET(req: Request) {
  await requireAuth();

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const externalId = Number(searchParams.get("externalId"));
  const type = searchParams.get("type");

  if ((source !== "tmdb" && source !== "jikan") || Number.isNaN(externalId) || externalId <= 0) {
    return errorResponse("Invalid parameters: source and externalId required", 400);
  }

  if (source === "tmdb" && type === "movie") {
    const preview = await fetchMoviePreview(externalId);
    return successResponse(preview);
  }

  if (source === "tmdb" && type === "tv") {
    const preview = await fetchTvPreview(externalId);
    return successResponse(preview);
  }

  if (source === "jikan") {
    const preview = await fetchAnimePreview(externalId);
    return successResponse(preview);
  }

  return errorResponse("Invalid source/type combination", 400);
}
