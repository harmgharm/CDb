/**
 * Hooks for the Poster Reveal Guessing Game
 */

import { useCallback, useState } from "react";
import useSWR from "swr";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type {
  GameSessionResponse,
  GuessResultResponse,
  LeaderboardResponse,
} from "@/types/game-responses";
// ── Media options for autocomplete ───────────────────────────────
import type { MediaListResponse } from "@/types/media-responses";

// ── Create Game ──────────────────────────────────────────────────

interface CreateGameParams {
  readonly difficulty: "normal" | "hard";
  readonly roundCount: number;
}

export function useCreateGame() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGame = useCallback(
    async (params: CreateGameParams): Promise<GameSessionResponse | null> => {
      setIsCreating(true);
      setError(null);
      try {
        const response = await fetchWithAuth("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const json = (await response.json()) as ApiResponse<GameSessionResponse>;
        if (json.error !== null) {
          setError(json.error);
          return null;
        }
        return json.data;
      } catch {
        setError("Failed to create game");
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  return { createGame, isCreating, error };
}

// ── Game State ───────────────────────────────────────────────────

export function useGameState(gameId: string | null) {
  return useSWR<GameSessionResponse>(gameId === null ? null : `/api/games/${gameId}`);
}

// ── Submit Guess ─────────────────────────────────────────────────

interface SubmitGuessParams {
  readonly gameId: string;
  readonly roundId: string;
  readonly guessText: string;
  readonly mediaId?: string;
  readonly timeFromStartMs: number;
}

export function useSubmitGuess() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitGuess = useCallback(
    async (params: SubmitGuessParams): Promise<GuessResultResponse | null> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const response = await fetchWithAuth(`/api/games/${params.gameId}/guess`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roundId: params.roundId,
            guessText: params.guessText,
            mediaId: params.mediaId,
            timeFromStartMs: params.timeFromStartMs,
          }),
        });
        const json = (await response.json()) as ApiResponse<GuessResultResponse>;
        if (json.error !== null) {
          setError(json.error);
          return null;
        }
        return json.data;
      } catch {
        setError("Failed to submit guess");
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return { submitGuess, isSubmitting, error };
}

// ── Next Round ───────────────────────────────────────────────────

interface NextRoundResult {
  readonly advanced: boolean;
  readonly finished: boolean;
}

export function useNextRound() {
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextRound = useCallback(async (gameId: string): Promise<NextRoundResult | null> => {
    setIsAdvancing(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`/api/games/${gameId}/rounds/next`, {
        method: "POST",
      });
      const json = (await response.json()) as ApiResponse<NextRoundResult>;
      if (json.error !== null) {
        setError(json.error);
        return null;
      }
      return json.data;
    } catch {
      setError("Failed to advance round");
      return null;
    } finally {
      setIsAdvancing(false);
    }
  }, []);

  return { nextRound, isAdvancing, error };
}

// ── Leaderboard ──────────────────────────────────────────────────

export function useLeaderboard(page = 1, limit = 20) {
  return useSWR<LeaderboardResponse>(
    `/api/games/leaderboard?page=${String(page)}&limit=${String(limit)}`,
  );
}

export function useGameMediaOptions() {
  return useSWR<MediaListResponse>("/api/media?limit=100");
}
