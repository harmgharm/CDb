"use client";

/**
 * SoloGame — Orchestrates the singleplayer game flow
 *
 * Flow: poster reveal → guess → round result → next round → ... → game result
 */

import { SkipForwardIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { GameResult } from "@/components/games/game-result";
import { GuessInput } from "@/components/games/guess-input";
import { getRoundStartTime, PosterReveal } from "@/components/games/poster-reveal";
import { RoundResult } from "@/components/games/round-result";
import { Button } from "@/components/ui/button";
import { useGameState, useNextRound, useSubmitGuess } from "@/hooks/use-games";
import type { GuessResultResponse } from "@/types/game-responses";
import type { MediaListItem } from "@/types/media-responses";

type RoundPhase = "guessing" | "result" | "finished";

interface SoloGameProps {
  readonly gameId: string;
  readonly mediaOptions: MediaListItem[];
  readonly onPlayAgain: () => void;
}

export function SoloGame({ gameId, mediaOptions, onPlayAgain }: SoloGameProps) {
  const { data: game, mutate } = useGameState(gameId);
  const { submitGuess, isSubmitting } = useSubmitGuess();
  const { nextRound, isAdvancing } = useNextRound();

  const [roundPhase, setRoundPhase] = useState<RoundPhase>("guessing");
  const [roundResult, setRoundResult] = useState<GuessResultResponse | null>(null);
  const [roundStartTime] = useState(getRoundStartTime);
  const [startTimeForRound, setStartTimeForRound] = useState(roundStartTime);
  // Guard against double-submission (guess + time-expired race)
  const submittedRef = useRef(false);

  const currentRound = useMemo(() => {
    if (game === undefined) return null;
    return game.rounds.find((round) => round.roundNumber === game.currentRound) ?? null;
  }, [game]);

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
        // API failed — reset guard so user can retry
        submittedRef.current = false;
      } else {
        setRoundResult(result);
        setRoundPhase("result");
      }
    },
    [currentRound, game, gameId, isSubmitting, startTimeForRound, submitGuess],
  );

  const handleSkip = useCallback(async () => {
    if (currentRound === null || game === undefined || submittedRef.current) return;
    submittedRef.current = true;

    const timeFromStartMs = Date.now() - startTimeForRound;

    const result = await submitGuess({
      gameId,
      roundId: currentRound.id,
      guessText: "(skipped)",
      timeFromStartMs,
    });

    // Always transition to result — use a fallback if the API call failed
    const fallbackResult: GuessResultResponse = {
      isCorrect: false,
      scoreAwarded: 0,
      streakBonus: 0,
      currentStreak: 0,
      correctTitle: currentRound.title ?? "Unknown",
      correctPosterUrl: currentRound.posterUrl ?? "",
      roundScore: 0,
    };

    setRoundResult(result ?? fallbackResult);
    setRoundPhase("result");
  }, [currentRound, game, gameId, startTimeForRound, submitGuess]);

  const handleTimeExpired = useCallback(() => {
    void handleSkip();
  }, [handleSkip]);

  const handleNextRound = useCallback(async () => {
    const result = await nextRound(gameId);
    if (result === null) return;

    if (result.finished) {
      // Refresh game data to get final state
      await mutate();
      setRoundPhase("finished");
    } else {
      // Reset for next round
      await mutate();
      setRoundResult(null);
      setStartTimeForRound(getRoundStartTime());
      submittedRef.current = false;
      setRoundPhase("guessing");
    }
  }, [gameId, mutate, nextRound]);

  if (game === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading game...</div>
      </div>
    );
  }

  // Game finished — show final results
  if (roundPhase === "finished" || game.status === "finished") {
    return <GameResult game={game} onPlayAgain={onPlayAgain} />;
  }

  // Between rounds — show result
  if (roundPhase === "result" && roundResult !== null) {
    return (
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
    );
  }

  // Active round — show poster + guess input
  if (currentRound?.posterUrl == null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Preparing round...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <ScoreHeader totalScore={game.totalScore} />

      {/* Round info */}
      <p className="text-muted-foreground text-sm">
        Round {String(game.currentRound + 1)} of {String(game.roundCount)}
      </p>

      {/* Poster reveal */}
      <PosterReveal
        posterUrl={currentRound.posterUrl}
        onTimeExpired={handleTimeExpired}
        isPaused={roundPhase !== "guessing"}
      />

      {/* Guess input */}
      <GuessInput
        key={game.currentRound}
        mediaOptions={mediaOptions}
        onGuess={(title, mediaId) => {
          void handleGuess(title, mediaId);
        }}
        disabled={isSubmitting}
        placeholder="Type a title and press Enter..."
      />

      {/* Skip button */}
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
