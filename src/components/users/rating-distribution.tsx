"use client";

import * as motion from "motion/react-client";

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

export function RatingDistribution({ distribution }: RatingDistributionProps) {
  // Fill in missing scores (1-10) with count 0
  const allScores = Array.from({ length: 10 }, (_, index) => {
    const score = index + 1;
    const bucket = distribution.find((b) => b.score === score);
    return { score, count: bucket?.count ?? 0 };
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
            {allScores.toReversed().map((bucket) => (
              <div key={bucket.score} className="flex items-center gap-3">
                <span className="text-muted-foreground w-6 text-right text-sm font-medium">
                  {String(bucket.score)}
                </span>
                <div className="bg-muted/30 h-7 flex-1 overflow-hidden rounded">
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
