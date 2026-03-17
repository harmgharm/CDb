/**
 * Response types for the Poster Reveal Guessing Game
 */

import type { GameDifficulty, GameMode, GameStatus, MediaType } from "@/lib/db/types";

// ── Media Pool ───────────────────────────────────────────────────

export interface MediaPoolItem {
  id: string | null;
  tmdbId: number | null;
  malId: number | null;
  title: string;
  posterUrl: string;
  type: MediaType;
}

// ── Game Session ─────────────────────────────────────────────────

export interface GameSessionResponse {
  id: string;
  mode: GameMode;
  difficulty: GameDifficulty;
  status: GameStatus;
  roundCount: number;
  currentRound: number;
  createdByUserId: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  rounds: GameRoundResponse[];
  totalScore: number;
  currentStreak: number;
}

// ── Game Round ───────────────────────────────────────────────────

export interface GameRoundResponse {
  id: string;
  roundNumber: number;
  /** NULL for rounds that haven't started yet (anti-cheat) */
  posterUrl: string | null;
  /** NULL for rounds that haven't started yet (anti-cheat) */
  title: string | null;
  mediaId: string | null;
  tmdbId: number | null;
  malId: number | null;
  startedAt: string | null;
  endedAt: string | null;
  guesses: GameGuessResponse[];
}

// ── Game Guess ───────────────────────────────────────────────────

export interface GameGuessResponse {
  id: string;
  userId: string;
  guessText: string;
  isCorrect: boolean;
  timeFromStartMs: number;
  scoreAwarded: number;
  createdAt: string;
}

// ── Guess Submission Result ──────────────────────────────────────

export interface GuessResultResponse {
  isCorrect: boolean;
  scoreAwarded: number;
  streakBonus: number;
  currentStreak: number;
  correctTitle: string;
  correctPosterUrl: string;
  roundScore: number;
}

// ── Leaderboard ──────────────────────────────────────────────────

export interface LeaderboardEntryResponse {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  roundsWon: number;
  totalScore: number;
  bestStreak: number;
  avgGuessTimeMs: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntryResponse[];
  total: number;
  page: number;
  limit: number;
}

// ── Autocomplete ─────────────────────────────────────────────────

export interface GameMediaOption {
  id: string;
  title: string;
  posterUrl: string | null;
  releaseYear: number | null;
  type: MediaType;
}
