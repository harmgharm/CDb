"use client";

/**
 * RoundResult — Shown between rounds with score and answer details
 */

import { CheckCircleIcon, FlameIcon, Loader2Icon, XCircleIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PosterRevealResultData } from "@/types/game-engine-data";
import type { GuessResultResponse, RoundEndedEvent } from "@/types/game-responses";

interface RoundResultProps {
  readonly result: GuessResultResponse;
  readonly roundNumber: number;
  readonly totalRounds: number;
  readonly onNextRound: () => void;
  readonly isAdvancing: boolean;
  readonly isLastRound: boolean;
  /** Game-specific answer display (replaces default poster thumbnail) */
  readonly answerDisplay?: React.ReactNode;
  /** Game-specific header (replaces default "Correct!" / "Wrong!") */
  readonly resultHeader?: React.ReactNode;
  /** Whether this is a multiplayer game (hides Next Round button) */
  readonly isMultiplayer?: boolean;
  /** Per-player round scores from round-ended event (multiplayer) */
  readonly roundScores?: RoundEndedEvent["scores"];
  /** Countdown duration in seconds for auto-advance (multiplayer) */
  readonly autoAdvanceSeconds?: number;
  /** Hide the built-in score breakdown (caller renders it elsewhere) */
  readonly hideScoreBreakdown?: boolean;
  /** Whether to show "1st" badge on first-correct player in round scores */
  readonly showFirstCorrect?: boolean;
  /** Render a game-specific guess label for each player row (e.g. guessed rating) */
  readonly renderGuessLabel?: (guessData: Record<string, unknown> | null) => React.ReactNode;
}

export function RoundResult({
  result,
  roundNumber,
  totalRounds,
  onNextRound,
  isAdvancing,
  isLastRound,
  answerDisplay,
  resultHeader,
  isMultiplayer,
  roundScores,
  autoAdvanceSeconds,
  hideScoreBreakdown,
  showFirstCorrect = true,
  renderGuessLabel,
}: RoundResultProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="flex flex-col items-center gap-6"
    >
      {/* Correct / Wrong indicator */}
      {resultHeader ?? (
        <div className="flex flex-col items-center gap-2">
          <span
            className={`flex size-14 items-center justify-center rounded-full ${
              result.isCorrect
                ? "text-cdb-success bg-[color-mix(in_oklch,var(--cdb-success)_16%,transparent)]"
                : "text-cdb-cherry-hi bg-[color-mix(in_oklch,var(--cdb-cherry)_16%,transparent)]"
            }`}
          >
            {result.isCorrect ? (
              <CheckCircleIcon className="size-7" />
            ) : (
              <XCircleIcon className="size-7" />
            )}
          </span>
          <h2 className="font-display text-[26px] font-semibold">
            {result.isCorrect ? "Correct!" : "Wrong!"}
          </h2>
        </div>
      )}

      {/* Answer reveal */}
      {answerDisplay ?? (
        <DefaultAnswerDisplay result={result} roundNumber={roundNumber} totalRounds={totalRounds} />
      )}

      {/* Score breakdown (can be hidden when caller renders it elsewhere) */}
      {hideScoreBreakdown !== true && result.isCorrect && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.3, ease: "easeOut" as const }}
          className="flex flex-col items-center gap-1"
        >
          <p className="text-cdb-marquee font-display text-[38px] leading-none">
            +{String(result.scoreAwarded)}
          </p>
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <span>Base: {String(result.roundScore)}</span>
            {result.streakBonus > 0 && (
              <span className="text-cdb-warning">Streak: +{String(result.streakBonus)}</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Streak display */}
      {result.currentStreak >= 2 && (
        <div className="text-cdb-warning flex items-center gap-1">
          <FlameIcon className="size-4" />
          <span className="text-sm font-semibold">{String(result.currentStreak)} streak!</span>
        </div>
      )}

      {/* Round scores (multiplayer) */}
      {roundScores !== undefined && roundScores.length > 0 && (
        <RoundScoresDisplay
          scores={roundScores}
          showFirstCorrect={showFirstCorrect}
          renderGuessLabel={renderGuessLabel}
        />
      )}

      {/* Next round button (solo) or auto-advance countdown (multiplayer) */}
      {isMultiplayer === true ? (
        <AutoAdvanceMessage
          isLastRound={isLastRound}
          durationSeconds={autoAdvanceSeconds ?? AUTO_ADVANCE_SECONDS}
        />
      ) : (
        <Button onClick={onNextRound} disabled={isAdvancing} size="lg" className="mt-2">
          {isLastRound ? "View results" : "Next round"}
        </Button>
      )}
    </motion.div>
  );
}

function DefaultAnswerDisplay({
  result,
  roundNumber,
  totalRounds,
}: Readonly<{ result: GuessResultResponse; roundNumber: number; totalRounds: number }>) {
  const data = result.resultData as unknown as PosterRevealResultData;
  const posterUrl = data.correctPosterUrl;
  const title = data.correctTitle;

  return (
    <div className="flex items-center gap-4">
      {posterUrl.length > 0 && (
        <div className="relative aspect-[2/3] w-20 overflow-hidden rounded-md shadow-lg">
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="80px"
            unoptimized
          />
        </div>
      )}
      <div>
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm">
          Round {String(roundNumber + 1)} of {String(totalRounds)}
        </p>
      </div>
    </div>
  );
}

const AUTO_ADVANCE_SECONDS = 5;

function AutoAdvanceMessage({
  isLastRound,
  durationSeconds,
}: Readonly<{ isLastRound: boolean; durationSeconds: number }>) {
  const [remaining, setRemaining] = useState(durationSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((previous) => {
        if (previous <= 1) {
          clearInterval(interval);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mt-2 flex items-center gap-2">
      <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
      <p className="text-muted-foreground text-sm">
        <AutoAdvanceLabel remaining={remaining} isLastRound={isLastRound} />
      </p>
    </div>
  );
}

function AutoAdvanceLabel({
  remaining,
  isLastRound,
}: Readonly<{ remaining: number; isLastRound: boolean }>) {
  if (remaining === 0) {
    return isLastRound ? "Loading results..." : "Starting...";
  }
  if (isLastRound) {
    return `Showing results in ${String(remaining)}s...`;
  }
  return `Next round in ${String(remaining)}s...`;
}

interface RoundScoresDisplayProps {
  readonly scores: RoundEndedEvent["scores"];
  readonly showFirstCorrect: boolean;
  readonly renderGuessLabel?: (guessData: Record<string, unknown> | null) => React.ReactNode;
}

function RoundScoresDisplay({
  scores,
  showFirstCorrect,
  renderGuessLabel,
}: RoundScoresDisplayProps) {
  const sorted = scores.toSorted((a, b) => b.scoreAwarded - a.scoreAwarded);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.3, ease: "easeOut" as const }}
      className="w-full max-w-sm"
    >
      <p className="mb-2 text-center text-xs font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
        Round scores
      </p>
      <div className="space-y-1.5">
        {sorted.map((score) => (
          <div
            key={score.userId}
            className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 py-2 text-sm"
          >
            {score.isCorrect ? (
              <CheckCircleIcon className="text-cdb-success size-3.5 shrink-0" />
            ) : (
              <XCircleIcon className="text-cdb-cherry-hi size-3.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">{score.username}</span>
            {renderGuessLabel !== undefined && (
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {renderGuessLabel(score.guessData)}
              </span>
            )}
            {showFirstCorrect && score.isFirstCorrect && (
              <span className="text-cdb-star text-[10px] font-semibold">1st</span>
            )}
            <span className="font-medium tabular-nums">+{String(score.scoreAwarded)}</span>
            {score.timeFromStartMs !== null && score.isCorrect && (
              <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                {(score.timeFromStartMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
