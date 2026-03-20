"use client";

/**
 * MultiplayerGame — Orchestrates the multiplayer game flow
 *
 * Driven by Ably events: round-started, player-guessed, round-countdown,
 * round-ended, game-ended. The host's client triggers round advancement
 * when the countdown expires.
 */

import { useChannel } from "ably/react";
import { SkipForwardIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LiveScoreboard } from "@/components/games/live-scoreboard";
import {
  PlayerGuessIndicators,
  usePlayerGuessIndicators,
} from "@/components/games/player-guess-indicator";
import { GuessInput } from "@/components/games/poster-reveal/guess-input";
import {
  getRoundStartTime,
  PosterReveal,
} from "@/components/games/poster-reveal/poster-reveal-visual";
import { RoundResult } from "@/components/games/round-result";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { useGameState, useNextRound, useSubmitGuess } from "@/hooks/use-games";
import {
  playCorrectSound,
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

/** How long the round result screen stays visible before transitioning (ms) */
const ROUND_RESULT_DISPLAY_MS = 5000;
/** Shorter display when all players finished — enough to glance at scores */
const ROUND_RESULT_QUICK_MS = 3000;
/** Total round timer (10s reveal + 5s grace) — must match poster-reveal-visual */
const ROUND_TIMER_MS = 15_000;
/** Host fallback: trigger advancement this many ms after the round timer expires */
const HOST_FALLBACK_BUFFER_MS = 3000;

type RoundPhase = "guessing" | "result" | "finished";

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
  const [playerOverrides, setPlayerOverrides] = useState<
    Map<string, { scoreAdded: number; roundsWonAdded: number }>
  >(new Map());
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [wrongGuessFlash, setWrongGuessFlash] = useState(false);
  const [roundScores, setRoundScores] = useState<RoundEndedEvent["scores"] | null>(null);
  const [resultDisplaySeconds, setResultDisplaySeconds] = useState(ROUND_RESULT_DISPLAY_MS / 1000);
  const submittedRef = useRef(false);
  const advancingRef = useRef(false);
  const wrongFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the poster reveal timer has expired — used to handle the race
  // condition where a wrong guess is in-flight when the timer fires.
  const timeExpiredRef = useRef(false);
  const roundStartDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp when the result screen was shown — used to compute remaining delay for game-ended
  const resultShownAtRef = useRef(0);
  // Whether all players guessed this round — shorter result display when true
  const allGuessedRef = useRef(false);
  // Host fallback timer — fires after round timer + buffer to ensure advancement
  const hostFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleSkip = useCallback(async () => {
    if (currentRound === null || game === undefined || submittedRef.current) return;
    submittedRef.current = true;
    playSkipSound();

    const timeFromStartMs = Date.now() - startTimeForRound;

    const result = await submitGuess({
      gameId,
      roundId: currentRound.id,
      guessText: "(skipped)",
      timeFromStartMs,
    });

    // Reset on failure so the fallback timer can retry
    if (result === null) {
      submittedRef.current = false;
    }
  }, [currentRound, game, gameId, startTimeForRound, submitGuess]);

  const showWrongFlash = useCallback(() => {
    setWrongGuessFlash(true);
    if (wrongFlashTimerRef.current !== null) {
      clearTimeout(wrongFlashTimerRef.current);
    }
    wrongFlashTimerRef.current = setTimeout(() => {
      setWrongGuessFlash(false);
      wrongFlashTimerRef.current = null;
    }, 1500);
  }, []);

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
        return;
      }

      if (result.isCorrect) {
        if (result.isFirstCorrect === true) {
          playFirstCorrectSound();
        } else {
          playCorrectSound();
        }
      } else {
        playWrongSound();
        showWrongFlash();
      }

      setRoundResult(result);

      if (!result.isCorrect) {
        submittedRef.current = false;
        // If the poster reveal timer already expired while this guess was in-flight,
        // auto-skip now to prevent the round from freezing.
        if (timeExpiredRef.current) {
          void handleSkip();
        }
      }
    },
    [
      currentRound,
      game,
      gameId,
      handleSkip,
      isSubmitting,
      showWrongFlash,
      startTimeForRound,
      submitGuess,
    ],
  );

  const handleTimeExpired = useCallback(() => {
    timeExpiredRef.current = true;
    if (!submittedRef.current) {
      playSkipSound();
      void handleSkip();
    }
    // If submittedRef.current is true (guess in-flight), the handleGuess callback
    // will check timeExpiredRef and auto-skip once the response arrives.
  }, [handleSkip]);

  const handleNextRound = useCallback(async () => {
    if (!advancingRef.current) {
      advancingRef.current = true;
      setIsAdvancing(true);
      await handleAdvanceRound();
    }
  }, [handleAdvanceRound]);

  // ── Host fallback timer ─────────────────────────────────────
  // Safety net: if allGuessed never fires (disconnect, failed auto-submit, missed
  // Ably event), the host triggers advancement after the round timer + buffer.

  const startHostFallbackTimer = useCallback(() => {
    if (hostFallbackTimerRef.current !== null) {
      clearTimeout(hostFallbackTimerRef.current);
    }
    hostFallbackTimerRef.current = setTimeout(() => {
      hostFallbackTimerRef.current = null;
      if (isHost && !advancingRef.current) {
        advancingRef.current = true;
        setIsAdvancing(true);
        void handleAdvanceRound();
      }
    }, ROUND_TIMER_MS + HOST_FALLBACK_BUFFER_MS);
  }, [isHost, handleAdvanceRound]);

  // Start fallback timer for the initial round on mount
  useEffect(() => {
    if (isHost && roundPhase === "guessing") {
      startHostFallbackTimer();
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
      // Clear fallback timer — normal advancement is happening
      if (hostFallbackTimerRef.current !== null) {
        clearTimeout(hostFallbackTimerRef.current);
        hostFallbackTimerRef.current = null;
      }
      if (isHost && !advancingRef.current) {
        advancingRef.current = true;
        setIsAdvancing(true);
        void handleAdvanceRound();
      }
    }
  });

  useChannel({ channelName }, "round-ended", (message) => {
    const event = message.data as RoundEndedEvent;

    if (roundResult === null) {
      const endedData = event.roundData as Record<string, string>;
      setRoundResult({
        isCorrect: false,
        scoreAwarded: 0,
        streakBonus: 0,
        currentStreak: 0,
        resultData: {
          correctTitle: endedData.title ?? "",
          correctPosterUrl: endedData.posterUrl ?? "",
        },
        roundScore: 0,
      });
    }

    setWrongGuessFlash(false);
    setRoundScores(event.scores);
    setResultDisplaySeconds(
      allGuessedRef.current ? ROUND_RESULT_QUICK_MS / 1000 : ROUND_RESULT_DISPLAY_MS / 1000,
    );
    resultShownAtRef.current = Date.now();
    setRoundPhase("result");
    clearIndicators();
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
      timeExpiredRef.current = false;
      setIsAdvancing(false);
      setRoundPhase("guessing");
      setWrongGuessFlash(false);
      clearIndicators();
      // Start fallback timer for the new round
      startHostFallbackTimer();
    }, delay);
  });

  useChannel({ channelName }, "game-ended", () => {
    // Clear host fallback timer — game is over
    if (hostFallbackTimerRef.current !== null) {
      clearTimeout(hostFallbackTimerRef.current);
      hostFallbackTimerRef.current = null;
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

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (wrongFlashTimerRef.current !== null) {
        clearTimeout(wrongFlashTimerRef.current);
      }
      if (roundStartDelayRef.current !== null) {
        clearTimeout(roundStartDelayRef.current);
      }
      if (hostFallbackTimerRef.current !== null) {
        clearTimeout(hostFallbackTimerRef.current);
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
            isMultiplayer
            roundScores={roundScores ?? undefined}
            autoAdvanceSeconds={resultDisplaySeconds}
          />
        </div>
        <div className="hidden lg:block">
          <LiveScoreboard players={players} onlineUserIds={onlineUserIds} />
        </div>
      </div>
    );
  }

  const multiPosterUrl = (currentRound?.roundData as Record<string, string> | undefined)?.posterUrl;
  if (multiPosterUrl == null) {
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

        <PosterReveal
          posterUrl={multiPosterUrl}
          onTimeExpired={handleTimeExpired}
          isPaused={hasGuessedCorrectly}
        />

        {hasGuessedCorrectly ? (
          <CorrectGuessBanner score={correctScore} />
        ) : (
          <>
            {wrongGuessFlash && <WrongGuessBanner />}

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

function WrongGuessBanner() {
  return (
    <div className="animate-shake rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-3 text-center">
      <p className="font-medium text-red-500">Wrong! Try again</p>
    </div>
  );
}
