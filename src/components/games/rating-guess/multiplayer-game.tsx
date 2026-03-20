"use client";

/**
 * MultiplayerGame — Orchestrates the multiplayer Rating Guesser flow
 *
 * Driven by Ably events: round-started, player-guessed, round-countdown,
 * round-ended, game-ended. The host's client triggers round advancement
 * when the countdown expires.
 */

import { useChannel } from "ably/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LiveScoreboard } from "@/components/games/live-scoreboard";
import {
  PlayerGuessIndicators,
  usePlayerGuessIndicators,
} from "@/components/games/player-guess-indicator";
import {
  getRatingResultHeader,
  RatingAnswerDisplay,
} from "@/components/games/rating-guess/rating-answer-display";
import {
  getRoundStartTime,
  RatingGuessVisual,
} from "@/components/games/rating-guess/rating-guess-visual";
import { DEFAULT_RATING_VALUE, RatingInput } from "@/components/games/rating-guess/rating-input";
import { RoundResult } from "@/components/games/round-result";
import { useAuth } from "@/components/providers/auth-provider";
import { useGameState, useNextRound, useSubmitGuess } from "@/hooks/use-games";
import {
  playCloseGuessSound,
  playCorrectSound,
  playFirstCorrectSound,
  playGameEndSound,
  playRoundStartSound,
  playWrongSound,
} from "@/lib/games/sounds";
import type { RatingGuessResultData, RatingGuessRoundData } from "@/types/game-engine-data";
import type {
  GamePlayerResponse,
  GuessResultResponse,
  PlayerGuessedEvent,
  RoundCountdownEvent,
  RoundEndedEvent,
} from "@/types/game-responses";

/** How long the round result screen stays visible before transitioning (ms) */
const ROUND_RESULT_DISPLAY_MS = 5000;
/** Shorter display when all players finished — enough to glance at scores */
const ROUND_RESULT_QUICK_MS = 3000;
/** Total round timer — must match rating-guess-visual DEFAULT_TOTAL_DURATION_MS */
const ROUND_TIMER_MS = 15_000;
/** Fallback: any player triggers advancement this many ms after the round timer expires */
const ROUND_FALLBACK_BUFFER_MS = 3000;
/** Post-submission fallback: if allGuessed doesn't fire within this window, try to advance */
const SUBMIT_FALLBACK_MS = 5000;

type RoundPhase = "guessing" | "result" | "finished";

interface MultiplayerGameProps {
  readonly gameId: string;
  readonly mediaOptions: unknown[];
  readonly onlineUserIds: Set<string>;
}

export function MultiplayerGame({ gameId, onlineUserIds }: MultiplayerGameProps) {
  const { user } = useAuth();
  const { data: game, mutate } = useGameState(gameId);
  const { submitGuess, isSubmitting } = useSubmitGuess();
  const { nextRound } = useNextRound();
  const { indicators, addIndicator, clearIndicators } = usePlayerGuessIndicators();

  const [roundPhase, setRoundPhase] = useState<RoundPhase>("guessing");
  const [roundResult, setRoundResult] = useState<GuessResultResponse | null>(null);
  const [startTimeForRound, setStartTimeForRound] = useState(getRoundStartTime);
  const [playerOverrides, setPlayerOverrides] = useState<
    Map<string, { scoreAdded: number; roundsWonAdded: number }>
  >(new Map());
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [roundScores, setRoundScores] = useState<RoundEndedEvent["scores"] | null>(null);
  const [resultDisplaySeconds, setResultDisplaySeconds] = useState(ROUND_RESULT_DISPLAY_MS / 1000);
  const submittedRef = useRef(false);
  const advancingRef = useRef(false);
  const currentRatingRef = useRef(DEFAULT_RATING_VALUE);
  const roundStartDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp when the result screen was shown — used to compute remaining delay for game-ended
  const resultShownAtRef = useRef(0);
  // Whether all players guessed this round — shorter result display when true
  const allGuessedRef = useRef(false);
  // Round fallback timer — fires after round timer + buffer to ensure advancement
  const roundFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Post-submission fallback — fires shortly after guess to cover allGuessed race condition
  const submitFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Game-ended fallback — re-fetches game state if game-ended event never arrives on last round
  const gameEndedFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const channelName = `game:${gameId}`;

  const players = useMemo(() => {
    const basePlayers = game?.players ?? [];
    if (playerOverrides.size === 0) return basePlayers;
    return basePlayers.map((player: GamePlayerResponse) => {
      const override = playerOverrides.get(player.userId);
      if (override === undefined) return player;
      return {
        ...player,
        totalScore: player.totalScore + override.scoreAdded,
        roundsWon: player.roundsWon + override.roundsWonAdded,
      };
    });
  }, [game?.players, playerOverrides]);

  const currentRound = useMemo(() => {
    if (game === undefined) return null;
    return game.rounds.find((round) => round.roundNumber === game.currentRound) ?? null;
  }, [game]);

  // ── Game actions ──────────────────────────────────────────────

  const handleAdvanceRound = useCallback(async () => {
    const result = await nextRound(gameId);
    if (result === null) {
      advancingRef.current = false;
      setIsAdvancing(false);
    }
  }, [gameId, nextRound]);

  const handleNextRound = useCallback(async () => {
    if (!advancingRef.current) {
      advancingRef.current = true;
      setIsAdvancing(true);
      await handleAdvanceRound();
    }
  }, [handleAdvanceRound]);

  // ── Advance fallback timers ─────────────────────────────────
  // Any player can trigger advancement (server allows it for multiplayer).
  // Two layers of fallback cover different failure modes:
  // 1. Round fallback: fires after round timer + buffer (covers auto-submit failures)
  // 2. Submit fallback: fires 5s after guess submission (covers allGuessed race condition)

  const tryAdvance = useCallback(() => {
    if (!advancingRef.current) {
      advancingRef.current = true;
      setIsAdvancing(true);
      void handleAdvanceRound();
    }
  }, [handleAdvanceRound]);

  const clearFallbackTimers = useCallback(() => {
    if (roundFallbackTimerRef.current !== null) {
      clearTimeout(roundFallbackTimerRef.current);
      roundFallbackTimerRef.current = null;
    }
    if (submitFallbackTimerRef.current !== null) {
      clearTimeout(submitFallbackTimerRef.current);
      submitFallbackTimerRef.current = null;
    }
  }, []);

  const startRoundFallbackTimer = useCallback(() => {
    if (roundFallbackTimerRef.current !== null) {
      clearTimeout(roundFallbackTimerRef.current);
    }
    roundFallbackTimerRef.current = setTimeout(() => {
      roundFallbackTimerRef.current = null;
      tryAdvance();
    }, ROUND_TIMER_MS + ROUND_FALLBACK_BUFFER_MS);
  }, [tryAdvance]);

  const startSubmitFallbackTimer = useCallback(() => {
    if (submitFallbackTimerRef.current !== null) {
      clearTimeout(submitFallbackTimerRef.current);
    }
    // Wait until the round timer has expired + buffer before trying to advance.
    // This avoids premature advance attempts when the other player hasn't submitted yet.
    const elapsed = Date.now() - startTimeForRound;
    const delay = Math.max(SUBMIT_FALLBACK_MS, ROUND_TIMER_MS - elapsed + SUBMIT_FALLBACK_MS);
    submitFallbackTimerRef.current = setTimeout(() => {
      submitFallbackTimerRef.current = null;
      tryAdvance();
    }, delay);
  }, [startTimeForRound, tryAdvance]);

  const handleGuess = useCallback(
    async (rating: number) => {
      if (currentRound === null || game === undefined || isSubmitting || submittedRef.current)
        return;
      submittedRef.current = true;

      const timeFromStartMs = Date.now() - startTimeForRound;

      const result = await submitGuess({
        gameId,
        roundId: currentRound.id,
        guessText: rating.toFixed(1),
        guessData: { guessedRating: rating },
        timeFromStartMs,
      });

      if (result === null) {
        submittedRef.current = false;
      } else {
        const resultData = result.resultData as unknown as RatingGuessResultData;
        playGuessSound(resultData.difference, result.isFirstCorrect === true);
        setRoundResult(result);
        // Successfully submitted — start fallback in case allGuessed doesn't fire
        startSubmitFallbackTimer();
      }
    },
    [
      currentRound,
      game,
      gameId,
      isSubmitting,
      startSubmitFallbackTimer,
      startTimeForRound,
      submitGuess,
    ],
  );

  const handleTimeExpired = useCallback(() => {
    if (!submittedRef.current) {
      void handleGuess(currentRatingRef.current);
    }
  }, [handleGuess]);

  const handleRatingChange = useCallback((rating: number) => {
    currentRatingRef.current = rating;
  }, []);

  // Start round fallback timer on mount (for the initial round)
  useEffect(() => {
    if (roundPhase === "guessing") {
      startRoundFallbackTimer();
    }
    // Only run on mount — subsequent rounds handled by round-started handler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Ably event handlers ──────────────────────────────────────

  useChannel({ channelName }, "player-guessed", (message) => {
    const event = message.data as PlayerGuessedEvent;
    if (event.userId !== user?.id) {
      addIndicator(event);
    }

    setPlayerOverrides((previous) => {
      const next = new Map(previous);
      const existing = next.get(event.userId) ?? { scoreAdded: 0, roundsWonAdded: 0 };
      next.set(event.userId, {
        scoreAdded: existing.scoreAdded + event.scoreAwarded,
        roundsWonAdded: existing.roundsWonAdded + (event.isCorrect ? 1 : 0),
      });
      return next;
    });
  });

  useChannel({ channelName }, "round-countdown", (message) => {
    const event = message.data as RoundCountdownEvent;

    if (event.allGuessed) {
      allGuessedRef.current = true;
      // Don't clear fallback timers — they act as safety net if advance fails.
      // The round-ended handler clears them on successful transition.
      tryAdvance();
    }
  });

  useChannel({ channelName }, "round-ended", (message) => {
    const event = message.data as RoundEndedEvent;
    // Round successfully advanced — clear fallback timers
    clearFallbackTimers();

    if (roundResult === null) {
      const endedData = event.roundData;
      setRoundResult({
        isCorrect: false,
        scoreAwarded: 0,
        streakBonus: 0,
        currentStreak: 0,
        resultData: {
          correctRating: Number(endedData.correctRating ?? 0),
          guessedRating: 0,
          difference: Number(endedData.correctRating ?? 0),
        },
        roundScore: 0,
      });
    }

    setRoundScores(event.scores);
    setResultDisplaySeconds(
      allGuessedRef.current ? ROUND_RESULT_QUICK_MS / 1000 : ROUND_RESULT_DISPLAY_MS / 1000,
    );
    resultShownAtRef.current = Date.now();
    setRoundPhase("result");
    clearIndicators();

    // On the last round, start a fallback timer in case game-ended never arrives
    // (e.g. serverless function terminated before publishing the Ably event)
    const isLastRound = game !== undefined && game.currentRound + 1 >= game.roundCount;
    if (isLastRound) {
      gameEndedFallbackTimerRef.current = setTimeout(() => {
        gameEndedFallbackTimerRef.current = null;
        // Re-fetch game state — if status is "finished", the render check handles transition
        void mutate();
      }, 8000);
    }
  });

  useChannel({ channelName }, "round-started", () => {
    // Buffer the round transition so the result screen stays visible.
    // Shorter delay when all players finished (just a glance at scores).
    const delay = allGuessedRef.current ? ROUND_RESULT_QUICK_MS : ROUND_RESULT_DISPLAY_MS;
    if (roundStartDelayRef.current !== null) {
      clearTimeout(roundStartDelayRef.current);
    }
    roundStartDelayRef.current = setTimeout(() => {
      roundStartDelayRef.current = null;
      resultShownAtRef.current = 0;
      allGuessedRef.current = false;
      void mutate();
      playRoundStartSound();
      setRoundResult(null);
      setRoundScores(null);
      setStartTimeForRound(getRoundStartTime());
      setPlayerOverrides(new Map());
      submittedRef.current = false;
      advancingRef.current = false;
      setIsAdvancing(false);
      currentRatingRef.current = DEFAULT_RATING_VALUE;
      setRoundPhase("guessing");
      clearIndicators();
      // Start round fallback timer for the new round
      startRoundFallbackTimer();
    }, delay);
  });

  useChannel({ channelName }, "game-ended", () => {
    // Game over — clear all fallback timers
    clearFallbackTimers();
    if (gameEndedFallbackTimerRef.current !== null) {
      clearTimeout(gameEndedFallbackTimerRef.current);
      gameEndedFallbackTimerRef.current = null;
    }
    const displayMs = allGuessedRef.current ? ROUND_RESULT_QUICK_MS : ROUND_RESULT_DISPLAY_MS;

    const processGameEnded = () => {
      resultShownAtRef.current = 0;
      allGuessedRef.current = false;
      void mutate();
      playGameEndSound();
      setRoundPhase("finished");
      clearIndicators();
      if (roundStartDelayRef.current !== null) {
        clearTimeout(roundStartDelayRef.current);
        roundStartDelayRef.current = null;
      }
    };

    // If showing a result screen, delay so players can see last round scores
    if (resultShownAtRef.current > 0) {
      const elapsed = Date.now() - resultShownAtRef.current;
      const remaining = Math.max(0, displayMs - elapsed);

      if (remaining > 0) {
        if (roundStartDelayRef.current !== null) {
          clearTimeout(roundStartDelayRef.current);
        }
        roundStartDelayRef.current = setTimeout(processGameEnded, remaining);
        return;
      }
    }

    processGameEnded();
  });

  useEffect(() => {
    return () => {
      if (roundStartDelayRef.current !== null) {
        clearTimeout(roundStartDelayRef.current);
      }
      if (roundFallbackTimerRef.current !== null) {
        clearTimeout(roundFallbackTimerRef.current);
      }
      if (submitFallbackTimerRef.current !== null) {
        clearTimeout(submitFallbackTimerRef.current);
      }
      if (gameEndedFallbackTimerRef.current !== null) {
        clearTimeout(gameEndedFallbackTimerRef.current);
      }
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────

  if (game === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading game...</div>
      </div>
    );
  }

  if (roundPhase === "finished" || game.status === "finished") {
    return null;
  }

  if (roundPhase === "result" && roundResult !== null) {
    const resultData = roundResult.resultData as unknown as RatingGuessResultData;
    const roundData = currentRound?.roundData as unknown as RatingGuessRoundData | undefined;
    const header = getRatingResultHeader(resultData.difference);

    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col items-center gap-4">
          <ScoreHeader totalScore={game.totalScore + roundResult.scoreAwarded} />
          <RoundResult
            result={roundResult}
            roundNumber={game.currentRound}
            totalRounds={game.roundCount}
            onNextRound={() => {
              void handleNextRound();
            }}
            isAdvancing={isAdvancing}
            isLastRound={game.currentRound + 1 >= game.roundCount}
            isMultiplayer
            roundScores={roundScores ?? undefined}
            autoAdvanceSeconds={resultDisplaySeconds}
            resultHeader={
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl">{header.icon}</span>
                <h2 className={`text-2xl font-bold ${header.colorClass}`}>{header.text}</h2>
              </div>
            }
            answerDisplay={
              <RatingAnswerDisplay
                resultData={resultData}
                posterUrl={roundData?.posterUrl ?? ""}
                title={roundData?.title ?? "Unknown"}
              />
            }
          />
        </div>
        <div className="hidden lg:block">
          <LiveScoreboard players={players} onlineUserIds={onlineUserIds} />
        </div>
      </div>
    );
  }

  const roundData = currentRound?.roundData as unknown as RatingGuessRoundData | undefined;
  if (roundData?.posterUrl === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Preparing round...</div>
      </div>
    );
  }

  const hasSubmitted = roundResult !== null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col items-center gap-6">
        <ScoreHeader totalScore={game.totalScore} />

        <p className="text-muted-foreground text-sm">
          Round {String(game.currentRound + 1)} of {String(game.roundCount)}
        </p>

        <RatingGuessVisual
          key={game.currentRound}
          posterUrl={roundData.posterUrl}
          title={roundData.title}
          ratingCount={roundData.ratingCount}
          onTimeExpired={handleTimeExpired}
          isPaused={hasSubmitted}
        />

        {hasSubmitted ? (
          <SubmittedBanner
            guessedRating={
              (roundResult.resultData as unknown as RatingGuessResultData).guessedRating
            }
            score={roundResult.scoreAwarded}
          />
        ) : (
          <RatingInput
            key={`input-${String(game.currentRound)}`}
            onSubmit={(rating) => {
              void handleGuess(rating);
            }}
            onValueChange={handleRatingChange}
            disabled={isSubmitting}
          />
        )}
      </div>

      <div className="hidden lg:block">
        <LiveScoreboard players={players} onlineUserIds={onlineUserIds} />
      </div>

      <PlayerGuessIndicators indicators={indicators} />
    </div>
  );
}

function ScoreHeader({ totalScore }: Readonly<{ totalScore: number }>) {
  return (
    <div className="text-center">
      <p className="text-muted-foreground text-xs tracking-wider uppercase">Score</p>
      <p className="text-3xl font-bold tabular-nums">{String(totalScore)}</p>
    </div>
  );
}

function SubmittedBanner({
  guessedRating,
  score,
}: Readonly<{ guessedRating: number; score: number }>) {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-6 py-3 text-center">
      <p className="font-medium text-blue-400">
        Submitted: {guessedRating.toFixed(1)} — +{String(score)} pts
      </p>
      <p className="text-muted-foreground mt-1 text-xs">Waiting for other players...</p>
    </div>
  );
}

function playGuessSound(difference: number, isFirstCorrect: boolean): void {
  if (isFirstCorrect) {
    playFirstCorrectSound();
    return;
  }
  if (difference < 1) {
    playCloseGuessSound();
  } else if (difference < 3) {
    playCorrectSound();
  } else {
    playWrongSound();
  }
}
