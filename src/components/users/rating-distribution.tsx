"use client";

import * as motion from "motion/react-client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RatingBucket } from "@/types/user-responses";

interface RatingDistributionProps {
  readonly distribution: RatingBucket[];
}

export function RatingDistribution({ distribution }: RatingDistributionProps) {
  // Fill in missing scores (1-10) with count 0
  const allScores = Array.from({ length: 10 }, (_, index) => {
    const score = index + 1;
    const bucket = distribution.find((b) => b.score === score);
    return { score, count: bucket?.count ?? 0 };
  });

  const maxCount = Math.max(...allScores.map((b) => b.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Rating Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {distribution.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No ratings yet</p>
        ) : (
          <div className="space-y-2">
            {allScores
              .toReversed()
              .filter((bucket) => bucket.count > 0)
              .map((bucket) => (
                <div key={bucket.score} className="flex items-center gap-3">
                  <span className="w-6 text-right text-sm font-medium">{String(bucket.score)}</span>
                  <div className="flex-1">
                    <motion.div
                      className="bg-primary h-6 rounded-sm"
                      initial={{ width: 0 }}
                      animate={{ width: `${String((bucket.count / maxCount) * 100)}%` }}
                      transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" as const }}
                    />
                  </div>
                  <span className="text-muted-foreground w-8 text-right text-xs">
                    {String(bucket.count)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
