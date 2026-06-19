"use client";

import { StarIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useState } from "react";

import { MediaPoster } from "@/components/media/media-poster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RatingBucket } from "@/types/user-responses";

interface RatingDistributionProps {
  readonly distribution: RatingBucket[];
  /** The user's average score, highlighted in --primary. Null hides the highlight. */
  readonly avgScore?: number | null;
}

function RatingDetailsList({ bucket }: { readonly bucket: RatingBucket }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" as const }}
      className="overflow-hidden"
    >
      <div className="mt-3 max-h-48 overflow-y-auto rounded-md border p-2">
        <div className="space-y-1.5">
          {bucket.ratings.map((rating) => (
            <Link
              key={`${rating.mediaId}-${String(rating.score)}`}
              href={`/database/${rating.mediaId}`}
              className="hover:bg-accent/50 flex items-center gap-2 rounded px-1.5 py-1 transition-colors"
            >
              <MediaPoster
                posterUrl={rating.posterUrl}
                title={rating.title}
                className="h-8 w-6 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{rating.title}</span>
              <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold tabular-nums">
                <StarIcon className="size-3 fill-amber-500 text-amber-500" />
                {String(rating.score)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/** The user's average bar is amber; an opened bar is muted; the rest are quiet. */
function resolveBarColor(isAvg: boolean, isExpanded: boolean): string {
  if (isAvg) return "bg-primary";
  if (isExpanded) return "bg-[var(--fg-muted)]";
  return "bg-[var(--bg-elev-3)] group-hover:bg-[var(--fg-dim)]";
}

export function RatingDistribution({ distribution, avgScore }: RatingDistributionProps) {
  const [expandedScore, setExpandedScore] = useState<number | null>(null);

  // Fill in missing scores (1-10) with count 0
  const allScores = Array.from({ length: 10 }, (_, index) => {
    const score = index + 1;
    const bucket = distribution.find((b) => b.score === score);
    return { score, count: bucket?.count ?? 0, ratings: bucket?.ratings ?? [] };
  });

  const maxCount = Math.max(...allScores.map((b) => b.count), 1);
  const totalRatings = allScores.reduce((sum, b) => sum + b.count, 0);
  const avgBar = avgScore === null || avgScore === undefined ? null : Math.round(avgScore);
  const expandedBucket = allScores.find((b) => b.score === expandedScore);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">Rating distribution</CardTitle>
        {totalRatings > 0 && (
          <span className="text-muted-foreground font-mono text-xs">
            {String(totalRatings)} ratings
            {avgScore !== null && avgScore !== undefined && ` · avg ${avgScore.toFixed(1)}`}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {distribution.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No ratings yet</p>
        ) : (
          <>
            <div className="grid h-40 grid-cols-10 items-end gap-2">
              {allScores.map((bucket) => {
                const hasRatings = bucket.count > 0;
                const isExpanded = expandedScore === bucket.score;
                const isAvg = avgBar === bucket.score;
                const heightPercent = hasRatings ? (bucket.count / maxCount) * 100 : 0;
                const barColor = resolveBarColor(isAvg, isExpanded);

                return (
                  <button
                    key={bucket.score}
                    type="button"
                    disabled={!hasRatings}
                    aria-pressed={isExpanded}
                    aria-label={`Score ${String(bucket.score)}, ${String(bucket.count)} ${bucket.count === 1 ? "rating" : "ratings"}`}
                    onClick={() => {
                      setExpandedScore(isExpanded ? null : bucket.score);
                    }}
                    className="group flex h-full flex-col items-center justify-end gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdb-marquee)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-default"
                  >
                    <span className="font-mono text-[10px] text-[var(--fg-muted)]">
                      {bucket.count > 0 ? String(bucket.count) : ""}
                    </span>
                    <div className="flex w-full flex-1 items-end justify-center">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${String(heightPercent)}%` }}
                        transition={{
                          delay: 0.05 + (bucket.score - 1) * 0.03,
                          duration: 0.5,
                          ease: "easeOut" as const,
                        }}
                        className={`min-h-1 w-[70%] rounded-sm transition-colors ${barColor}`}
                      />
                    </div>
                    <span
                      className={`font-mono text-[10px] ${
                        isAvg ? "text-cdb-marquee" : "text-[var(--fg-dim)]"
                      }`}
                    >
                      {String(bucket.score)}
                    </span>
                  </button>
                );
              })}
            </div>

            {expandedBucket !== undefined && expandedBucket.count > 0 && (
              <div className="mt-1">
                <div className="text-muted-foreground mb-1 font-mono text-[11px] tracking-[0.04em] uppercase">
                  Rated {String(expandedBucket.score)}
                </div>
                <RatingDetailsList bucket={expandedBucket} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
