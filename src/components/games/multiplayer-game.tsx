"use client";

/**
 * MultiplayerGame — Orchestrates the multiplayer game flow
 *
 * Driven by Ably events: round-started, player-guessed, round-countdown,
 * round-ended, game-ended. The host's client triggers round advancement
 * when the countdown expires.
 */

import { useChannel } from "ably/react";
import { SkipForwardIcon, TimerIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GuessInput } from "@/components/games/guess-input";
import { LiveScoreboard } from "@/components/games/live-scoreboard";
import {
  PlayerGuessIndicators,
  usePlayerGuessIndicators,
} from "@/components/games/player-guess-indicator";
import { getRoundStartTime, PosterReveal } from "@/components/games/poster-reveal";
import { RoundResult } from "@/components/games/round-result";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { useGameState, useNextRound, useSubmitGuess } from "@/hooks/use-games";
import {
  playCorrectSound,
  playCountdownTickSound,
  playFirstCorrectSound,
  playGameEndSound,
  playRoundStartSound,
  playSkipSound,
  playWrongSound,
} from "@/lib/games/sounds";
import type {
  GuessResultResponse,
  PlayerGuessedEvent,
  RoundCountdownEvent,
  RoundEndedEvent,
} from "@/types/game-responses";
import type { MediaListItem } from "@/types/media-responses";

type RoundPhase = "guessing" | "countdown" | "result" | "finished";

interface MultiplayerGameProps {
  readonly gameId: string;
  readonly mediaOptions: MediaListItem[];
  readonly onlineUserIds: Set<string>;
}

export function MultiplayerGame({ gameId, mediaOptions, onlineUserIds }: MultiplayerGameProps) {
  const { user } = useAuth();
  const { data: game, mutate } = useGameState(gameId);
  const { submitGuess, isSubmitting } = useSubmitGuess();
  const { nextRound } = useNextRound();
  const { indicators, addIndicator, clearIndicators } = usePlayerGuessIndicators();

  const [roundPhase, setRoundPhase] = useState<RoundPhase>("guessing");
  const [roundResult, setRoundResult] = useState<GuessResultResponse | null>(null);
  const [startTimeForRound, setStartTimeForRound] = useState(getRoundStartTime);
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const [playerOverrides, setPlayerOverrides] = useState<
    Map<string, { scoreAdded: number; roundsWonAdded: number }>
  >(new Map());
  const [isAdvancing, setIsAdvancing] = useState(false);
  const submittedRef = useRef(false);
  const advancingRef = useRef(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const channelName = `game:${gameId}`;
  const isHost = user?.id === game?.createdByUserId;

  // Derive players from SWR data + real-time overrides
  const players = useMemo(() => {
    const basePlayers = game?.players ?? [];
    if (playerOverrides.size === 0) return basePlayers;
    return basePlayers.map((player) => {
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

  // ── Game actions (declared before Ably handlers that reference them) ──

  const handleAdvanceRound = useCallback(async () => {
    const result = await nextRound(gameId);
    if (result === null) {
      advancingRef.current = false;
      setIsAdvancing(false);
    }
  }, [gameId, nextRound]);

  const handleGuess = useCallback(
    async (title: string, mediaId?: string) => {
      if (currentRound === null || game === undefined || isSubmitting || submittedRef.current)
        return;
      submittedRef.current = true;

      const timeFromStartMs = Date.now() - startTimeForRound;

      const result = await submitGuess({
        gameId,
        roundId: currentRound.id,
        guessText: title,
        mediaId,
        timeFromStartMs,
      });

      if (result === null) {
        submittedRef.current = false;
      } else {
        if (result.isCorrect) {
          if (result.isFirstCorrect === true) {
            playFirstCorrectSound();
          } else {
            playCorrectSound();
          }
        } else {
          playWrongSound();
        }
        setRoundResult(result);
        if (!result.isCorrect) {
          submittedRef.current = false;
        }
      }
    },
    [currentRound, game, gameId, isSubmitting, startTimeForRound, submitGuess],
  );

  const handleSkip = useCallback(async () => {
    if (currentRound === null || game === undefined || submittedRef.current) return;
    submittedRef.current = true;
    playSkipSound();

    const timeFromStartMs = Date.now() - startTimeForRound;

    await submitGuess({
      gameId,
      roundId: currentRound.id,
      guessText: "(skipped)",
      timeFromStartMs,
    });
  }, [currentRound, game, gameId, startTimeForRound, submitGuess]);

  const handleTimeExpired = useCallback(() => {
    if (!submittedRef.current) {
      playSkipSound();
      void handleSkip();
    }
  }, [handleSkip]);

  const handleNextRound = useCallback(async () => {
    if (!advancingRef.current) {
      advancingRef.current = true;
      setIsAdvancing(true);
      await handleAdvanceRound();
    }
  }, [handleAdvanceRound]);

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
      if (isHost && !advancingRef.current) {
        advancingRef.current = true;
        setIsAdvancing(true);
        void handleAdvanceRound();
      }
      return;
    }

    const endsAt = new Date(event.endsAt).getTime();
    setCountdownEndsAt(endsAt);
    setRoundPhase("countdown");
    playCountdownTickSound();

    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
    }
    countdownTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, endsAt - Date.now());
      setCountdownRemaining(remaining);

      if (remaining <= 0) {
        if (countdownTimerRef.current !== null) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        if (isHost && !advancingRef.current) {
          advancingRef.current = true;
          setIsAdvancing(true);
          void handleAdvanceRound();
        }
      }
    }, 100);
  });

  useChannel({ channelName }, "round-ended", (message) => {
    const event = message.data as RoundEndedEvent;

    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownEndsAt(null);

    if (roundResult === null) {
      setRoundResult({
        isCorrect: false,
        scoreAwarded: 0,
        streakBonus: 0,
        currentStreak: 0,
        correctTitle: event.correctTitle,
        correctPosterUrl: event.correctPosterUrl,
        roundScore: 0,
      });
    }

    setRoundPhase("result");
    clearIndicators();
  });

  useChannel({ channelName }, "round-started", () => {
    void mutate();
    playRoundStartSound();
    setRoundResult(null);
    setStartTimeForRound(getRoundStartTime());
    setPlayerOverrides(new Map());
    submittedRef.current = false;
    advancingRef.current = false;
    setIsAdvancing(false);
    setRoundPhase("guessing");
    clearIndicators();
  });

  useChannel({ channelName }, "game-ended", () => {
    void mutate();
    playGameEndSound();
    setRoundPhase("finished");
    clearIndicators();
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  });

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current !== null) {
        clearInterval(countdownTimerRef.current);
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
          />
        </div>
        <div className="hidden lg:block">
          <LiveScoreboard players={players} onlineUserIds={onlineUserIds} />
        </div>
      </div>
    );
  }

  if (currentRound?.posterUrl == null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Preparing round...</div>
      </div>
    );
  }

  const hasGuessedCorrectly = roundResult?.isCorrect === true;
  const correctScore = roundResult === null ? 0 : roundResult.scoreAwarded;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col items-center gap-6">
        <ScoreHeader totalScore={game.totalScore} />

        <p className="text-muted-foreground text-sm">
          Round {String(game.currentRound + 1)} of {String(game.roundCount)}
        </p>

        {roundPhase === "countdown" && countdownEndsAt !== null && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2">
            <TimerIcon className="size-4 text-yellow-500" />
            <span className="text-sm font-medium">
              Round ending in {(countdownRemaining / 1000).toFixed(1)}s
            </span>
          </div>
        )}

        <PosterReveal
          posterUrl={currentRound.posterUrl}
          onTimeExpired={handleTimeExpired}
          isPaused={hasGuessedCorrectly}
        />

        {hasGuessedCorrectly ? (
          <CorrectGuessBanner score={correctScore} />
        ) : (
          <>
            <GuessInput
              key={game.currentRound}
              mediaOptions={mediaOptions}
              onGuess={(title, mediaId) => {
                void handleGuess(title, mediaId);
              }}
              disabled={isSubmitting}
              placeholder="Type a title and press Enter..."
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleSkip();
              }}
              disabled={isSubmitting}
              className="text-muted-foreground"
            >
              <SkipForwardIcon className="mr-1 size-4" />
              Skip
            </Button>
          </>
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

function CorrectGuessBanner({ score }: Readonly<{ score: number }>) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-center">
      <p className="font-medium text-emerald-500">Correct! +{String(score)} pts</p>
      <p className="text-muted-foreground mt-1 text-xs">Waiting for other players...</p>
    </div>
  );
}
