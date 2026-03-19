/**
 * Poster Reveal Game Engine
 *
 * A blurred poster slowly reveals itself — players guess the media title
 * before time runs out. Scored by speed (faster = more points).
 */

import { db } from "@/lib/db";
import type { GameDifficulty } from "@/lib/db/types";
import type { CorrectnessResult, GameEngine, RoundPoolItem } from "@/lib/games/engine";
import { isCorrectGuess } from "@/lib/games/matching";
import { buildMediaPool } from "@/lib/games/media-pool";
import { registerEngine } from "@/lib/games/registry";
import type { PosterRevealResultData, PosterRevealRoundData } from "@/types/game-engine-data";

const TOTAL_WINDOW_MS = 15_000;

/**
 * Check if the guessed media ID matches the round's answer by direct ID or external IDs.
 */
async function checkMediaIdMatch(
  mediaId: string,
  roundData: PosterRevealRoundData,
): Promise<boolean> {
  if (roundData.mediaId !== null && mediaId === roundData.mediaId) {
    return true;
  }

  const selectedMedia = await db
    .selectFrom("media")
    .select(["tmdb_id", "mal_id"])
    .where("id", "=", mediaId)
    .executeTakeFirst();

  if (selectedMedia === undefined) return false;

  const tmdbMatch =
    roundData.tmdbId !== null &&
    selectedMedia.tmdb_id !== null &&
    roundData.tmdbId === selectedMedia.tmdb_id;
  const malMatch =
    roundData.malId !== null &&
    selectedMedia.mal_id !== null &&
    roundData.malId === selectedMedia.mal_id;

  return tmdbMatch || malMatch;
}

const posterRevealEngine: GameEngine = {
  gameType: "poster_reveal",
  displayName: "Poster Reveal",
  basePath: "/play/poster-reveal",
  totalWindowMs: TOTAL_WINDOW_MS,

  async buildPool(difficulty: GameDifficulty, count: number): Promise<RoundPoolItem[]> {
    const poolItems = await buildMediaPool(difficulty, count);

    return poolItems.map((item) => ({
      roundData: {
        posterUrl: item.posterUrl,
        title: item.title,
        mediaId: item.id,
        tmdbId: item.tmdbId,
        malId: item.malId,
      } satisfies PosterRevealRoundData,
    }));
  },

  async checkCorrectness(guess: {
    guessText: string | null;
    guessMediaId: string | null;
    guessData: Record<string, unknown> | undefined;
    roundData: Record<string, unknown>;
  }): Promise<CorrectnessResult> {
    const { guessText, guessMediaId, roundData } = guess;
    const data = roundData as unknown as PosterRevealRoundData;

    // Check media ID match (autocomplete selection)
    if (guessMediaId !== null) {
      const idMatch = await checkMediaIdMatch(guessMediaId, data);
      if (idMatch) {
        return { isCorrect: true, details: {} };
      }
    }

    // Fallback: fuzzy text matching
    if (guessText !== null) {
      const textMatch = isCorrectGuess(guessText, data.title);
      return { isCorrect: textMatch, details: {} };
    }

    return { isCorrect: false, details: {} };
  },

  maskRoundData(
    roundData: Record<string, unknown>,
    phase: "not_started" | "active" | "ended",
  ): Record<string, unknown> {
    const data = roundData as unknown as PosterRevealRoundData;

    switch (phase) {
      case "not_started": {
        return {};
      }
      case "active": {
        return {
          posterUrl: data.posterUrl,
          mediaId: data.mediaId,
          tmdbId: data.tmdbId,
          malId: data.malId,
        };
      }
      case "ended": {
        return { ...data };
      }
    }
  },

  buildGuessResultData(roundData: Record<string, unknown>): Record<string, unknown> {
    const data = roundData as unknown as PosterRevealRoundData;
    return {
      correctTitle: data.title,
      correctPosterUrl: data.posterUrl,
    } satisfies PosterRevealResultData;
  },

  buildRoundStartedData(roundData: Record<string, unknown>): Record<string, unknown> {
    const data = roundData as unknown as PosterRevealRoundData;
    return { posterUrl: data.posterUrl };
  },

  buildRoundEndedData(roundData: Record<string, unknown>): Record<string, unknown> {
    const data = roundData as unknown as PosterRevealRoundData;
    return {
      correctTitle: data.title,
      correctPosterUrl: data.posterUrl,
    };
  },

  buildGameStartedData(roundData: Record<string, unknown>): Record<string, unknown> {
    const data = roundData as unknown as PosterRevealRoundData;
    return { posterUrl: data.posterUrl };
  },
};

registerEngine(posterRevealEngine);

export { posterRevealEngine };
