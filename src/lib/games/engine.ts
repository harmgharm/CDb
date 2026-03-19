/**
 * Game Engine Interface
 *
 * Each game type (poster reveal, rating guess, etc.) implements this interface.
 * API routes delegate game-specific operations to the engine, keeping shared
 * infrastructure (sessions, lobbies, players, leaderboards) in the routes.
 */

import type { GameDifficulty, GameType } from "@/lib/db/types";

/**
 * An item from the round pool returned by the engine's buildPool().
 * The engine populates roundData with game-specific payload.
 */
export interface RoundPoolItem {
  /** Game-specific round payload stored as round_data JSONB */
  roundData: Record<string, unknown>;
}

/**
 * Result of a correctness check from the engine.
 */
export interface CorrectnessResult {
  isCorrect: boolean;
  /** Extra data to store in guess_data JSONB */
  details: Record<string, unknown>;
}

/**
 * The engine contract that every game type must implement.
 */
export interface GameEngine {
  readonly gameType: GameType;
  readonly displayName: string;
  /** Base URL path for this game's pages (e.g. "/play/poster-reveal") */
  readonly basePath: string;
  /** Max time window for scoring (ms) — passed to calculateRoundScore() */
  readonly totalWindowMs: number;

  /**
   * Override the default time-based scoring with game-specific logic.
   * If provided, the guess route uses this instead of calculateRoundScore().
   */
  calculateScore?(guess: {
    guessData: Record<string, unknown> | undefined;
    roundData: Record<string, unknown>;
    timeFromStartMs: number;
  }): number;

  /** Build pool of items for rounds */
  buildPool(difficulty: GameDifficulty, count: number): Promise<RoundPoolItem[]>;

  /**
   * Check guess correctness against round data.
   * Returns isCorrect + any details to persist in guess_data.
   */
  checkCorrectness(guess: {
    guessText: string | null;
    guessMediaId: string | null;
    guessData: Record<string, unknown> | undefined;
    roundData: Record<string, unknown>;
  }): Promise<CorrectnessResult>;

  /**
   * Mask round_data for anti-cheat based on round phase.
   * Returns a filtered copy that is safe to send to the client.
   */
  maskRoundData(
    roundData: Record<string, unknown>,
    phase: "not_started" | "active" | "ended",
  ): Record<string, unknown>;

  /** Build game-specific fields for the guess result response */
  buildGuessResultData(
    roundData: Record<string, unknown>,
    guessData: Record<string, unknown>,
  ): Record<string, unknown>;

  /** Build game-specific payload for the round-started Ably event */
  buildRoundStartedData(roundData: Record<string, unknown>): Record<string, unknown>;

  /** Build game-specific payload for the round-ended Ably event */
  buildRoundEndedData(roundData: Record<string, unknown>): Record<string, unknown>;

  /** Build game-specific payload for the game-started Ably event */
  buildGameStartedData(roundData: Record<string, unknown>): Record<string, unknown>;
}
