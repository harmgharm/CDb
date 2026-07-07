"use client";

/**
 * YearAnswerDisplay — Custom answer display for Year Guesser round results
 *
 * Shows the poster, title, your guess vs actual year with large prominent numbers,
 * and a color-coded difference badge. Designed to be readable at a quick glance
 * during the 3-5 second post-round result screen.
 *
 * Passed as `answerDisplay` to the shared RoundResult component.
 */

import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckCircle2Icon,
  type LucideIcon,
  TargetIcon,
  ThumbsUpIcon,
  WindIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import Image from "next/image";

import type { YearGuessResultData } from "@/types/game-engine-data";

interface YearAnswerDisplayProps {
  readonly resultData: YearGuessResultData;
  readonly posterUrl: string;
  readonly title: string;
}

export function YearAnswerDisplay({ resultData, posterUrl, title }: YearAnswerDisplayProps) {
  const { correctYear, guessedYear, difference } = resultData;
  const guessColor = getGuessColor(difference);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Poster + title */}
      <div className="flex items-center gap-3">
        {posterUrl.length > 0 && (
          <div className="relative aspect-[2/3] w-14 overflow-hidden rounded-md shadow-lg">
            <Image
              src={posterUrl}
              alt={title}
              fill
              className="object-cover"
              sizes="56px"
              unoptimized
            />
          </div>
        )}
        <p className="max-w-48 text-lg leading-tight font-semibold">{title}</p>
      </div>

      {/* Large guess vs actual comparison */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" as const }}
        className="flex items-center gap-4"
      >
        <div className="flex flex-col items-center">
          <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Yours
          </span>
          <span className={`text-4xl font-bold tabular-nums ${guessColor}`}>
            {String(guessedYear)}
          </span>
        </div>
        <ArrowRightIcon className="text-muted-foreground mt-4 size-5" />
        <div className="flex flex-col items-center">
          <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Actual
          </span>
          <span className="text-4xl font-bold tabular-nums">{String(correctYear)}</span>
        </div>
      </motion.div>

      {/* Difference badge */}
      <DifferenceBadge difference={difference} />
    </div>
  );
}

function getGuessColor(difference: number): string {
  if (difference <= 2) return "text-cdb-success";
  if (difference <= 5) return "text-cdb-info";
  if (difference <= 8) return "text-cdb-warning";
  return "text-cdb-cherry-hi";
}

function DifferenceBadge({ difference }: Readonly<{ difference: number }>) {
  const { label, colorClass } = getDifferenceDisplay(difference);

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${colorClass}`}
    >
      <CalendarIcon className="size-3.5" />
      {label}
    </div>
  );
}

function getDifferenceDisplay(difference: number): { label: string; colorClass: string } {
  const yearLabel = difference === 1 ? "year" : "years";
  if (difference === 0) {
    return {
      label: "Spot on!",
      colorClass: "bg-[color-mix(in_oklch,var(--cdb-success)_20%,transparent)] text-cdb-success",
    };
  }
  if (difference <= 2) {
    return {
      label: `Off by ${String(difference)} ${yearLabel}`,
      colorClass: "bg-[color-mix(in_oklch,var(--cdb-success)_20%,transparent)] text-cdb-success",
    };
  }
  if (difference <= 5) {
    return {
      label: `Off by ${String(difference)} ${yearLabel}`,
      colorClass: "bg-[color-mix(in_oklch,var(--cdb-info)_20%,transparent)] text-cdb-info",
    };
  }
  if (difference <= 8) {
    return {
      label: `Off by ${String(difference)} ${yearLabel}`,
      colorClass: "bg-[color-mix(in_oklch,var(--cdb-warning)_20%,transparent)] text-cdb-warning",
    };
  }
  return {
    label: `Off by ${String(difference)} ${yearLabel}`,
    colorClass: "bg-[color-mix(in_oklch,var(--cdb-cherry)_20%,transparent)] text-cdb-cherry-hi",
  };
}

/**
 * Build a result header for the RoundResult component based on accuracy.
 */
export function getYearResultHeader(difference: number): {
  icon: LucideIcon;
  text: string;
  colorClass: string;
} {
  if (difference === 0) {
    return { icon: TargetIcon, text: "Spot on!", colorClass: "text-cdb-success" };
  }
  if (difference <= 1) {
    return { icon: CheckCircle2Icon, text: "Excellent!", colorClass: "text-cdb-success" };
  }
  if (difference <= 3) {
    return { icon: ThumbsUpIcon, text: "Close!", colorClass: "text-cdb-info" };
  }
  if (difference <= 5) {
    return { icon: AlertTriangleIcon, text: "Not bad", colorClass: "text-cdb-warning" };
  }
  if (difference < 10) {
    return { icon: AlertTriangleIcon, text: "Far off", colorClass: "text-cdb-warning" };
  }
  return { icon: WindIcon, text: "Way off!", colorClass: "text-cdb-cherry-hi" };
}
