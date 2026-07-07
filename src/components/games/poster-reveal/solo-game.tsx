"use client";

/**
 * SoloGame — Orchestrates the singleplayer game flow
 *
 * Flow: poster reveal → guess → round result → next round → ... → game result
 */

import { SkipForwardIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { GameResult } from "@/components/games/game-result";
import { GuessInput } from "@/components/games/poster-reveal/guess-input";
import {
  getRoundStartTime,
  PosterReveal,
} from "@/components/games/poster-reveal/poster-reveal-visual";
import { RoundResult } from "@/components/games/round-result";
import { Button } from "@/components/ui/button";
import { useGameState, useNextRound, useSubmitGuess } from "@/hooks/use-games";
import {
  playCorrectSound,
  playGameEndSound,
  playRoundStartSound,
  playSkipSound,
  playWrongSound,
} from "@/lib/games/sounds";
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
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false);
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
        if (result.isCorrect) {
          playCorrectSound();
        } else {
          playWrongSound();
        }
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
    const roundData = currentRound.roundData as Record<string, string>;
    const fallbackResult: GuessResultResponse = {
      isCorrect: false,
      scoreAwarded: 0,
      streakBonus: 0,
      currentStreak: 0,
      resultData: {
        correctTitle: roundData.title ?? "Unknown",
        correctPosterUrl: roundData.posterUrl ?? "",
      },
      roundScore: 0,
    };

    setRoundResult(result ?? fallbackResult);
    setRoundPhase("result");
  }, [currentRound, game, gameId, startTimeForRound, submitGuess]);

  const handleTimeExpired = useCallback(() => {
    playSkipSound();
    void handleSkip();
  }, [handleSkip]);

  const handleNextRound = useCallback(async () => {
    const result = await nextRound(gameId);
    if (result === null) return;

    if (result.finished) {
      // Refresh game data to get final state
      await mutate();
      playGameEndSound();
      setIsNewPersonalBest(result.isNewPersonalBest);
      setRoundPhase("finished");
    } else {
      // Reset for next round
      await mutate();
      playRoundStartSound();
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
    return (
      <GameResult game={game} onPlayAgain={onPlayAgain} isNewPersonalBest={isNewPersonalBest} />
    );
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
  const activePosterUrl = (currentRound?.roundData as Record<string, string> | undefined)
    ?.posterUrl;
  if (activePosterUrl == null) {
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
        posterUrl={activePosterUrl}
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
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
        Score
      </p>
      <p className="font-display text-[40px] leading-none">{String(totalScore)}</p>
    </div>
  );
}
