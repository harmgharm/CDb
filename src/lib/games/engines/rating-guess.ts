/**
 * Rating Guess Game Engine
 *
 * Players see a movie/show/anime and guess its rating (0.0–10.0).
 * Normal mode uses the group's average rating; hard mode uses TMDB/Jikan public ratings.
 * Scored by accuracy: max(0, 1000 - floor(difference * 333)). Zero at 3.0+ off.
 */

import type { GameDifficulty } from "@/lib/db/types";
import type { CorrectnessResult, GameEngine, RoundPoolItem } from "@/lib/games/engine";
import { buildRatingPool } from "@/lib/games/rating-pool";
import { registerEngine } from "@/lib/games/registry";
import type {
  RatingGuessGuessData,
  RatingGuessResultData,
  RatingGuessRoundData,
} from "@/types/game-engine-data";

const TOTAL_WINDOW_MS = 10_000;

/** Accuracy-based score: 1000 at exact, 0 at 3.0+ difference */
function calculateAccuracyScore(difference: number): number {
  return Math.max(0, 1000 - Math.floor(difference * 333));
}

const ratingGuessEngine: GameEngine = {
  gameType: "rating_guess",
  displayName: "Rating Guesser",
  basePath: "/play/rating-guess",
  totalWindowMs: TOTAL_WINDOW_MS,
  hasFirstCorrectBonus: false,

  async buildPool(difficulty: GameDifficulty, count: number): Promise<RoundPoolItem[]> {
    const poolItems = await buildRatingPool(difficulty, count);

    return poolItems.map((item) => ({
      roundData: {
        mediaId: item.id,
        title: item.title,
        posterUrl: item.posterUrl,
        correctRating: item.correctRating,
        ratingCount: item.ratingCount,
        tmdbId: item.tmdbId,
        malId: item.malId,
      } satisfies RatingGuessRoundData,
    }));
  },

  checkCorrectness(guess: {
    guessText: string | null;
    guessMediaId: string | null;
    guessData: Record<string, unknown> | undefined;
    roundData: Record<string, unknown>;
  }): Promise<CorrectnessResult> {
    const roundData = guess.roundData as unknown as RatingGuessRoundData;

    // Skip handling — no guess submitted
    if (guess.guessText === "(skipped)") {
      return Promise.resolve({ isCorrect: false, details: {} });
    }

    const guessData = guess.guessData as RatingGuessGuessData | undefined;
    const guessedRating = guessData?.guessedRating ?? 0;
    const difference = Math.round(Math.abs(guessedRating - roundData.correctRating) * 10) / 10;

    // Always "correct" for non-skip guesses so multiplayer "all done" check works
    // and streaks continue (any score > 0 = streak)
    return Promise.resolve({
      isCorrect: true,
      details: {
        guessedRating,
        difference,
      },
    });
  },

  calculateScore(guess: {
    guessData: Record<string, unknown> | undefined;
    roundData: Record<string, unknown>;
  }): number {
    const roundData = guess.roundData as unknown as RatingGuessRoundData;
    const guessData = guess.guessData as RatingGuessGuessData | undefined;
    const guessedRating = guessData?.guessedRating ?? 0;
    const difference = Math.abs(guessedRating - roundData.correctRating);
    return calculateAccuracyScore(difference);
  },

  maskRoundData(
    roundData: Record<string, unknown>,
    phase: "not_started" | "active" | "ended",
  ): Record<string, unknown> {
    const data = roundData as unknown as RatingGuessRoundData;

    switch (phase) {
      case "not_started": {
        return {};
      }
      case "active": {
        // Hide correctRating during active round (anti-cheat)
        return {
          mediaId: data.mediaId,
          title: data.title,
          posterUrl: data.posterUrl,
          ratingCount: data.ratingCount,
          tmdbId: data.tmdbId,
          malId: data.malId,
        };
      }
      case "ended": {
        return { ...data };
      }
    }
  },

  buildGuessResultData(
    roundData: Record<string, unknown>,
    guessData: Record<string, unknown>,
  ): Record<string, unknown> {
    const data = roundData as unknown as RatingGuessRoundData;
    const guess = guessData as { guessedRating: number; difference: number };
    return {
      correctRating: data.correctRating,
      guessedRating: guess.guessedRating,
      difference: guess.difference,
    } satisfies RatingGuessResultData;
  },

  buildRoundStartedData(roundData: Record<string, unknown>): Record<string, unknown> {
    const data = roundData as unknown as RatingGuessRoundData;
    return {
      title: data.title,
      posterUrl: data.posterUrl,
      ratingCount: data.ratingCount,
    };
  },

  buildRoundEndedData(roundData: Record<string, unknown>): Record<string, unknown> {
    const data = roundData as unknown as RatingGuessRoundData;
    return {
      title: data.title,
      posterUrl: data.posterUrl,
      correctRating: data.correctRating,
      ratingCount: data.ratingCount,
    };
  },

  buildGameStartedData(roundData: Record<string, unknown>): Record<string, unknown> {
    const data = roundData as unknown as RatingGuessRoundData;
    return {
      title: data.title,
      posterUrl: data.posterUrl,
      ratingCount: data.ratingCount,
    };
  },
};

registerEngine(ratingGuessEngine);

export { ratingGuessEngine };
