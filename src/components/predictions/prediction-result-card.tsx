"use client";

import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  HelpCircleIcon,
  MinusCircleIcon,
  PlayCircleIcon,
  ThumbsUpIcon,
  UsersIcon,
} from "lucide-react";
import * as motion from "motion/react-client";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PredictionResult, PredictionSignal } from "@/types/prediction-responses";

function getGroupComparisonStyle(predicted: number, group: number): string {
  if (predicted > group) return "border-emerald-500/30 text-emerald-400";
  if (predicted < group) return "border-red-500/30 text-red-400";
  return "border-border text-muted-foreground";
}

function getGroupComparisonLabel(predicted: number, group: number): string {
  const diff = Math.round((predicted - group) * 10) / 10;
  if (predicted > group) return `+${String(diff)} vs group`;
  if (predicted < group) return `${String(diff)} vs group`;
  return "Same as group";
}

interface PredictionResultCardProps {
  readonly prediction: PredictionResult;
}

const SCORE_COLORS: Record<string, string> = {
  high: "text-emerald-400",
  mid: "text-blue-400",
  mixed: "text-yellow-400",
  low: "text-red-400",
};

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string }> = {
  high: { bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400" },
  medium: { bg: "bg-yellow-500/10 border-yellow-500/30", text: "text-yellow-400" },
  low: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400" },
};

function getScoreColor(score: number): string {
  if (score >= 8) return SCORE_COLORS.high ?? "";
  if (score >= 6.5) return SCORE_COLORS.mid ?? "";
  if (score >= 5) return SCORE_COLORS.mixed ?? "";
  return SCORE_COLORS.low ?? "";
}

function getVerdictIcon(score: number) {
  if (score >= 8) return <CheckCircle2Icon className="size-5 text-emerald-400" />;
  if (score >= 6.5) return <ThumbsUpIcon className="size-5 text-blue-400" />;
  if (score >= 5) return <HelpCircleIcon className="size-5 text-yellow-400" />;
  return <MinusCircleIcon className="size-5 text-red-400" />;
}

const SIGNAL_LABELS: Record<string, string> = {
  collaborative: "Similar Taste",
  genre: "Genre Match",
  director: "Director",
  external: "Community",
  group: "Group Rating",
  era: "Era & Format",
};

function SignalRow({ signal }: { readonly signal: PredictionSignal }) {
  const label = SIGNAL_LABELS[signal.name] ?? signal.name;
  const hasScore = signal.score !== null;

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-muted-foreground w-24 shrink-0 truncate">{label}</span>
      <span
        className={`w-10 shrink-0 text-right font-mono ${hasScore ? "text-foreground" : "text-muted-foreground"}`}
      >
        {hasScore ? String(signal.score) : "N/A"}
      </span>
      {/* Weight bar */}
      <div className="bg-muted h-1.5 w-16 shrink-0 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${String(Math.round(signal.weight * 100))}%` }}
        />
      </div>
      <span className="text-muted-foreground min-w-0 flex-1 truncate">{signal.detail}</span>
    </div>
  );
}

export function PredictionResultCard({ prediction }: PredictionResultCardProps) {
  const scoreColor = getScoreColor(prediction.predictedScore);
  const fallbackStyle = { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400" };
  const confidenceStyle = CONFIDENCE_STYLES[prediction.confidence] ?? fallbackStyle;
  const hasGroupData = prediction.groupAverage !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
    >
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Left: Poster + basic info */}
            <div className="flex shrink-0 gap-4 sm:flex-col sm:items-center">
              <div className="w-[100px] shrink-0 overflow-hidden rounded-lg sm:w-[120px]">
                <MediaPoster
                  posterUrl={prediction.posterUrl}
                  title={prediction.title}
                  className="aspect-[2/3] w-full"
                />
              </div>
              <div className="min-w-0 sm:text-center">
                <h3 className="line-clamp-2 text-sm font-semibold">{prediction.title}</h3>
                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs sm:justify-center">
                  {prediction.releaseYear !== null && <span>{String(prediction.releaseYear)}</span>}
                  <MediaTypeBadge type={prediction.mediaType} />
                </div>
                {prediction.directors.length > 0 && (
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {prediction.directors.slice(0, 2).join(", ")}
                  </p>
                )}
                {prediction.trailerUrl !== null && (
                  <a
                    href={prediction.trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground mt-1.5 inline-flex items-center gap-1.5 text-xs transition-colors"
                  >
                    <PlayCircleIcon className="size-3.5" />
                    <span className="font-medium">Watch Trailer</span>
                    <ExternalLinkIcon className="size-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Center: Score + verdict */}
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center gap-4">
                {/* Large score circle */}
                <div className="border-border flex size-16 shrink-0 items-center justify-center rounded-full border-2">
                  <span className={`text-2xl font-bold ${scoreColor}`}>
                    {String(prediction.predictedScore)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {getVerdictIcon(prediction.predictedScore)}
                    <span className="text-sm font-medium">{prediction.verdict}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${confidenceStyle.bg} ${confidenceStyle.text}`}
                        >
                          {prediction.confidence} confidence
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-52 text-xs">
                        Based on {String(prediction.signals.filter((s) => s.score !== null).length)}{" "}
                        of 6 available signals
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* Group comparison */}
              {hasGroupData && prediction.groupAverage !== null && (
                <div className="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2">
                  <UsersIcon className="text-muted-foreground size-3.5 shrink-0" />
                  <span className="text-xs">
                    Your group rated this{" "}
                    <span className="font-semibold">{String(prediction.groupAverage)}</span> avg (
                    {String(prediction.groupRatingCount)} rating
                    {prediction.groupRatingCount === 1 ? "" : "s"})
                  </span>
                  <Badge
                    variant="outline"
                    className={`ml-auto text-[10px] ${getGroupComparisonStyle(prediction.predictedScore, prediction.groupAverage)}`}
                  >
                    {getGroupComparisonLabel(prediction.predictedScore, prediction.groupAverage)}
                  </Badge>
                </div>
              )}

              {/* Signal breakdown */}
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Signal Breakdown
                </p>
                <div className="space-y-1.5">
                  {prediction.signals.map((signal) => (
                    <SignalRow key={signal.name} signal={signal} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
