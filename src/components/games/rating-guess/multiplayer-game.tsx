"use client";

/**
 * MultiplayerGame — Orchestrates the multiplayer Rating Guesser flow
 *
 * Driven by Ably events: round-started, player-guessed, round-countdown,
 * round-ended, game-ended. The host's client triggers round advancement
 * when the countdown expires.
 */

import { useChannel } from "ably/react";
import { TimerIcon } from "lucide-react";
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
  playCountdownTickSound,
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

type RoundPhase = "guessing" | "countdown" | "result" | "finished";

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
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const [playerOverrides, setPlayerOverrides] = useState<
    Map<string, { scoreAdded: number; roundsWonAdded: number }>
  >(new Map());
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [roundScores, setRoundScores] = useState<RoundEndedEvent["scores"] | null>(null);
  const submittedRef = useRef(false);
  const advancingRef = useRef(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentRatingRef = useRef(DEFAULT_RATING_VALUE);
  const roundStartDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp when the result screen was shown — used to compute remaining delay for game-ended
  const resultShownAtRef = useRef(0);

  const channelName = `game:${gameId}`;
  const isHost = user?.id === game?.createdByUserId;

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
        // Rating guess: one submission per round, so stay submitted
      }
    },
    [currentRound, game, gameId, isSubmitting, startTimeForRound, submitGuess],
  );

  const handleTimeExpired = useCallback(() => {
    if (!submittedRef.current) {
      void handleGuess(currentRatingRef.current);
    }
  }, [handleGuess]);

  const handleRatingChange = useCallback((rating: number) => {
    currentRatingRef.current = rating;
  }, []);

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
    resultShownAtRef.current = Date.now();
    setRoundPhase("result");
    clearIndicators();
  });

  useChannel({ channelName }, "round-started", () => {
    // Buffer the round transition so the result screen stays visible
    if (roundStartDelayRef.current !== null) {
      clearTimeout(roundStartDelayRef.current);
    }
    roundStartDelayRef.current = setTimeout(() => {
      roundStartDelayRef.current = null;
      resultShownAtRef.current = 0;
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
    }, ROUND_RESULT_DISPLAY_MS);
  });

  useChannel({ channelName }, "game-ended", () => {
    const processGameEnded = () => {
      resultShownAtRef.current = 0;
      void mutate();
      playGameEndSound();
      setRoundPhase("finished");
      clearIndicators();
      if (countdownTimerRef.current !== null) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (roundStartDelayRef.current !== null) {
        clearTimeout(roundStartDelayRef.current);
        roundStartDelayRef.current = null;
      }
    };

    // If showing a result screen, delay so players can see last round scores
    if (resultShownAtRef.current > 0) {
      const elapsed = Date.now() - resultShownAtRef.current;
      const remaining = Math.max(0, ROUND_RESULT_DISPLAY_MS - elapsed);

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
      if (countdownTimerRef.current !== null) {
        clearInterval(countdownTimerRef.current);
      }
      if (roundStartDelayRef.current !== null) {
        clearTimeout(roundStartDelayRef.current);
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

        {roundPhase === "countdown" && countdownEndsAt !== null && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2">
            <TimerIcon className="size-4 text-yellow-500" />
            <span className="text-sm font-medium">
              Round ending in {(countdownRemaining / 1000).toFixed(1)}s
            </span>
          </div>
        )}

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
