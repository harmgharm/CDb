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
}

/** Color scale from red (1) through yellow (5) to green (10) */
const SCORE_COLORS: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-red-400",
  3: "bg-orange-500",
  4: "bg-orange-400",
  5: "bg-yellow-500",
  6: "bg-yellow-400",
  7: "bg-lime-500",
  8: "bg-green-500",
  9: "bg-emerald-500",
  10: "bg-emerald-400",
};

function RatingDetailsList({ bucket }: { readonly bucket: RatingBucket }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" as const }}
      className="overflow-hidden"
    >
      <div className="mt-1.5 ml-9 max-h-48 overflow-y-auto rounded-md border p-2">
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
              <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold">
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

export function RatingDistribution({ distribution }: RatingDistributionProps) {
  const [expandedScore, setExpandedScore] = useState<number | null>(null);

  // Fill in missing scores (1-10) with count 0
  const allScores = Array.from({ length: 10 }, (_, index) => {
    const score = index + 1;
    const bucket = distribution.find((b) => b.score === score);
    return { score, count: bucket?.count ?? 0, ratings: bucket?.ratings ?? [] };
  });

  const maxCount = Math.max(...allScores.map((b) => b.count), 1);
  const totalRatings = allScores.reduce((sum, b) => sum + b.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Rating Distribution
          {totalRatings > 0 && (
            <span className="text-muted-foreground ml-1 font-normal">
              ({String(totalRatings)} ratings)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {distribution.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No ratings yet</p>
        ) : (
          <div className="space-y-1.5">
            {allScores.toReversed().map((bucket) => {
              const isExpanded = expandedScore === bucket.score;
              const hasRatings = bucket.count > 0;

              return (
                <div key={bucket.score}>
                  <div
                    role={hasRatings ? "button" : undefined}
                    tabIndex={hasRatings ? 0 : undefined}
                    className={`flex items-center gap-3 ${hasRatings ? "cursor-pointer" : ""}`}
                    onClick={() => {
                      if (hasRatings) {
                        setExpandedScore(isExpanded ? null : bucket.score);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (hasRatings && (event.key === "Enter" || event.key === " ")) {
                        setExpandedScore(isExpanded ? null : bucket.score);
                      }
                    }}
                  >
                    <span className="text-muted-foreground w-6 text-right text-sm font-medium">
                      {String(bucket.score)}
                    </span>
                    <div
                      className={`h-7 flex-1 overflow-hidden rounded transition-colors ${
                        isExpanded ? "bg-accent" : "bg-muted/30"
                      }`}
                    >
                      {bucket.count > 0 && (
                        <motion.div
                          className={`flex h-full items-center rounded ${SCORE_COLORS[bucket.score] ?? "bg-primary"}`}
                          style={{ opacity: 0.85 }}
                          initial={{ width: 0 }}
                          animate={{ width: `${String((bucket.count / maxCount) * 100)}%` }}
                          transition={{
                            delay: 0.1 + (10 - bucket.score) * 0.03,
                            duration: 0.5,
                            ease: "easeOut" as const,
                          }}
                        >
                          <span className="px-2 text-xs font-medium text-white drop-shadow-sm">
                            {String(bucket.count)}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                  {isExpanded && hasRatings && <RatingDetailsList bucket={bucket} />}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
