"use client";

import { CheckCircleIcon, ChevronDownIcon, XCircleIcon } from "lucide-react";
import { useMemo } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type {
  GameGuessResponse,
  GamePlayerResponse,
  GameRoundResponse,
} from "@/types/game-responses";

interface RoundBreakdownRowProps {
  readonly round: GameRoundResponse;
  readonly index: number;
  readonly standings: GamePlayerResponse[];
  readonly gameType: string;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
}

export function RoundBreakdownRow({
  round,
  index,
  standings,
  gameType,
  isOpen,
  onToggle,
}: RoundBreakdownRowProps) {
  const correctGuesses = round.guesses
    .filter((guess) => guess.isCorrect)
    .toSorted((a, b) => b.scoreAwarded - a.scoreAwarded);
  const roundWinner = correctGuesses[0];
  const winnerPlayer = roundWinner
    ? standings.find((s) => s.userId === roundWinner.userId)
    : undefined;

  // Get the "final" guess per player — for poster-reveal a player may have multiple
  // wrong guesses then a correct one or skip, so take the last guess per user
  const playerGuesses = useMemo(() => {
    const byUser = new Map<string, GameGuessResponse>();
    for (const guess of round.guesses) {
      const existing = byUser.get(guess.userId);
      // Keep correct guess over wrong ones, otherwise keep the latest
      if (existing === undefined || guess.isCorrect || !existing.isCorrect) {
        byUser.set(guess.userId, guess);
      }
    }
    return [...byUser.values()].toSorted((a, b) => b.scoreAwarded - a.scoreAwarded);
  }, [round.guesses]);

  const isRatingGuess = gameType === "rating_guess";
  const { roundData } = round;
  const correctRating = isRatingGuess ? Number(roundData.correctRating ?? 0) : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="bg-card hover:bg-accent/50 flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors">
        <span className="text-muted-foreground w-8 text-center text-sm font-medium">
          #{String(index + 1)}
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">
            {typeof roundData.title === "string" ? roundData.title : "Unknown"}
          </p>
          {winnerPlayer === undefined ? (
            <p className="text-muted-foreground text-xs">No correct guesses</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Won by {winnerPlayer.displayName ?? winnerPlayer.username}
              {roundWinner !== undefined && ` (+${String(roundWinner.scoreAwarded)})`}
            </p>
          )}
        </div>
        <div className="text-muted-foreground text-xs">
          {String(correctGuesses.length)}/{String(standings.length)} correct
        </div>
        <ChevronDownIcon
          className={`text-muted-foreground size-4 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-card space-y-1 rounded-b-lg border border-t-0 px-3 pt-2 pb-3">
          {playerGuesses.map((guess) => (
            <PlayerRoundResult
              key={guess.userId}
              guess={guess}
              standings={standings}
              isRatingGuess={isRatingGuess}
              correctRating={correctRating}
              isFirstCorrect={roundWinner?.userId === guess.userId && guess.isCorrect}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PlayerRoundResult({
  guess,
  standings,
  isRatingGuess,
  correctRating,
  isFirstCorrect,
}: Readonly<{
  guess: GameGuessResponse;
  standings: GamePlayerResponse[];
  isRatingGuess: boolean;
  correctRating: number;
  isFirstCorrect: boolean;
}>) {
  const player = standings.find((s) => s.userId === guess.userId);
  const name = player?.displayName ?? guess.username ?? "Unknown";
  const isSkipped = guess.guessText === "(skipped)";

  return (
    <div className="flex items-center gap-2 text-sm">
      {guess.isCorrect && !isSkipped ? (
        <CheckCircleIcon className="size-3.5 shrink-0 text-green-500" />
      ) : (
        <XCircleIcon className="size-3.5 shrink-0 text-red-500" />
      )}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {isFirstCorrect && <span className="text-[10px] font-medium text-yellow-500">1st</span>}
      {isRatingGuess ? (
        <RatingGuessDetail guess={guess} correctRating={correctRating} />
      ) : (
        <PosterRevealDetail guess={guess} />
      )}
      <span className="w-12 text-right font-medium tabular-nums">
        +{String(guess.scoreAwarded)}
      </span>
    </div>
  );
}

function RatingGuessDetail({
  guess,
  correctRating,
}: Readonly<{ guess: GameGuessResponse; correctRating: number }>) {
  const guessData = guess.guessData as { guessedRating?: number; difference?: number } | undefined;
  const guessedRating = guessData?.guessedRating;
  const difference = guessData?.difference;

  if (guessedRating === undefined) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  const diffColor = getDifferenceColor(difference ?? 0);

  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-xs tabular-nums">
      <span>{guessedRating.toFixed(1)}</span>
      <span className="text-muted-foreground/60">/</span>
      <span>{correctRating.toFixed(1)}</span>
      <span className={diffColor}>({(difference ?? 0).toFixed(1)} off)</span>
    </span>
  );
}

function PosterRevealDetail({ guess }: Readonly<{ guess: GameGuessResponse }>) {
  const isSkipped = guess.guessText === "(skipped)";

  if (isSkipped) {
    return <span className="text-muted-foreground text-xs">Skipped</span>;
  }

  if (guess.isCorrect) {
    return (
      <span className="text-muted-foreground text-xs tabular-nums">
        {(guess.timeFromStartMs / 1000).toFixed(1)}s
      </span>
    );
  }

  return <span className="text-muted-foreground text-xs">Wrong</span>;
}

function getDifferenceColor(difference: number): string {
  if (difference < 1) return "text-green-500";
  if (difference < 2) return "text-yellow-500";
  return "text-red-500";
}
