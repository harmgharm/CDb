"use client";

/**
 * RatingAnswerDisplay — Custom answer display for Rating Guesser round results
 *
 * Shows the poster, title, your guess vs actual rating, and a difference badge.
 * Passed as `answerDisplay` to the shared RoundResult component.
 */

import { TargetIcon } from "lucide-react";
import Image from "next/image";

import type { RatingGuessResultData } from "@/types/game-engine-data";

interface RatingAnswerDisplayProps {
  readonly resultData: RatingGuessResultData;
  readonly posterUrl: string;
  readonly title: string;
}

export function RatingAnswerDisplay({ resultData, posterUrl, title }: RatingAnswerDisplayProps) {
  const { correctRating, guessedRating, difference } = resultData;

  return (
    <div className="flex items-center gap-4">
      {posterUrl.length > 0 && (
        <div className="relative aspect-[2/3] w-16 overflow-hidden rounded-md shadow-lg">
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="64px"
            unoptimized
          />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-lg font-semibold">{title}</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Your guess: <span className="font-medium text-white">{guessedRating.toFixed(1)}</span>
          </span>
          <span className="text-muted-foreground">
            Actual: <span className="font-medium text-white">{correctRating.toFixed(1)}</span>
          </span>
        </div>
        <DifferenceBadge difference={difference} />
      </div>
    </div>
  );
}

function DifferenceBadge({ difference }: Readonly<{ difference: number }>) {
  const { label, colorClass } = getDifferenceDisplay(difference);

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      <TargetIcon className="size-3" />
      {label}
    </div>
  );
}

function getDifferenceDisplay(difference: number): { label: string; colorClass: string } {
  if (difference === 0) {
    return { label: "Perfect!", colorClass: "bg-emerald-500/20 text-emerald-400" };
  }
  if (difference <= 0.5) {
    return {
      label: `Off by ${difference.toFixed(1)}`,
      colorClass: "bg-emerald-500/20 text-emerald-400",
    };
  }
  if (difference <= 1) {
    return {
      label: `Off by ${difference.toFixed(1)}`,
      colorClass: "bg-blue-500/20 text-blue-400",
    };
  }
  if (difference <= 2) {
    return {
      label: `Off by ${difference.toFixed(1)}`,
      colorClass: "bg-yellow-500/20 text-yellow-400",
    };
  }
  return {
    label: `Off by ${difference.toFixed(1)}`,
    colorClass: "bg-red-500/20 text-red-400",
  };
}

/**
 * Build a result header for the RoundResult component based on accuracy.
 */
export function getRatingResultHeader(difference: number): {
  icon: string;
  text: string;
  colorClass: string;
} {
  if (difference === 0) {
    return { icon: "🎯", text: "Spot On!", colorClass: "text-emerald-500" };
  }
  if (difference <= 0.5) {
    return { icon: "🎯", text: "Excellent!", colorClass: "text-emerald-500" };
  }
  if (difference <= 1) {
    return { icon: "👏", text: "Close!", colorClass: "text-blue-500" };
  }
  if (difference <= 2) {
    return { icon: "🤏", text: "Not Bad", colorClass: "text-yellow-500" };
  }
  if (difference < 3) {
    return { icon: "😬", text: "Far Off", colorClass: "text-orange-500" };
  }
  return { icon: "💨", text: "Way Off!", colorClass: "text-red-500" };
}
