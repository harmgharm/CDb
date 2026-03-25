/**
 * Year Guess Game Engine
 *
 * Players see a movie/show/anime and guess its release year.
 * Normal mode uses media from the group's database; hard mode uses TMDB/Jikan titles.
 * Scored by accuracy: max(0, 1000 - floor(yearDifference * 100)). Zero at 10+ years off.
 */

import type { GameDifficulty } from "@/lib/db/types";
import type { CorrectnessResult, GameEngine, RoundPoolItem } from "@/lib/games/engine";
import { registerEngine } from "@/lib/games/registry";
import { buildYearPool } from "@/lib/games/year-pool";
import type {
  YearGuessGuessData,
  YearGuessResultData,
  YearGuessRoundData,
} from "@/types/game-engine-data";

const TOTAL_WINDOW_MS = 10_000;

/** Accuracy-based score: 1000 at exact, 0 at 10+ years difference */
function calculateAccuracyScore(difference: number): number {
  return Math.max(0, 1000 - Math.floor(difference * 100));
}

const yearGuessEngine: GameEngine = {
  gameType: "year_guess",
  displayName: "Year Guesser",
  basePath: "/play/year-guess",
  totalWindowMs: TOTAL_WINDOW_MS,
  hasFirstCorrectBonus: false,

  async buildPool(difficulty: GameDifficulty, count: number): Promise<RoundPoolItem[]> {
    const poolItems = await buildYearPool(difficulty, count);

    return poolItems.map((item) => ({
      roundData: {
        mediaId: item.id,
        title: item.title,
        posterUrl: item.posterUrl,
        correctYear: item.correctYear,
        tmdbId: item.tmdbId,
        malId: item.malId,
      } satisfies YearGuessRoundData,
    }));
  },

  checkCorrectness(guess: {
    guessText: string | null;
    guessMediaId: string | null;
    guessData: Record<string, unknown> | undefined;
    roundData: Record<string, unknown>;
  }): Promise<CorrectnessResult> {
    const roundData = guess.roundData as unknown as YearGuessRoundData;

    // Skip handling — no guess submitted
    if (guess.guessText === "(skipped)") {
      return Promise.resolve({ isCorrect: false, details: {} });
    }

    const guessData = guess.guessData as YearGuessGuessData | undefined;
    const guessedYear = guessData?.guessedYear ?? 2000;
    const difference = Math.abs(guessedYear - roundData.correctYear);

    // Always "correct" for non-skip guesses so multiplayer "all done" check works
    // and streaks continue (any score > 0 = streak)
    return Promise.resolve({
      isCorrect: true,
      details: {
        guessedYear,
        difference,
      },
    });
  },

  calculateScore(guess: {
    guessData: Record<string, unknown> | undefined;
    roundData: Record<string, unknown>;
  }): number {
    const roundData = guess.roundData as unknown as YearGuessRoundData;
    const guessData = guess.guessData as YearGuessGuessData | undefined;
    const guessedYear = guessData?.guessedYear ?? 2000;
    const difference = Math.abs(guessedYear - roundData.correctYear);
    return calculateAccuracyScore(difference);
  },

  maskRoundData(
    roundData: Record<string, unknown>,
    phase: "not_started" | "active" | "ended",
  ): Record<string, unknown> {
    const data = roundData as unknown as YearGuessRoundData;

    switch (phase) {
      case "not_started": {
        return {};
      }
      case "active": {
        // Hide correctYear during active round (anti-cheat)
        return {
          mediaId: data.mediaId,
          title: data.title,
          posterUrl: data.posterUrl,
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
    const data = roundData as unknown as YearGuessRoundData;
    const guess = guessData as { guessedYear: number; difference: number };
    return {
      correctYear: data.correctYear,
      guessedYear: guess.guessedYear,
      difference: guess.difference,
    } satisfies YearGuessResultData;
  },

  buildRoundStartedData(roundData: Record<string, unknown>): Record<string, unknown> {
    const data = roundData as unknown as YearGuessRoundData;
    return {
      title: data.title,
      posterUrl: data.posterUrl,
    };
  },

  buildRoundEndedData(roundData: Record<string, unknown>): Record<string, unknown> {
    const data = roundData as unknown as YearGuessRoundData;
    return {
      title: data.title,
      posterUrl: data.posterUrl,
      correctYear: data.correctYear,
    };
  },

  buildGameStartedData(roundData: Record<string, unknown>): Record<string, unknown> {
    const data = roundData as unknown as YearGuessRoundData;
    return {
      title: data.title,
      posterUrl: data.posterUrl,
    };
  },
};

registerEngine(yearGuessEngine);

export { yearGuessEngine };
