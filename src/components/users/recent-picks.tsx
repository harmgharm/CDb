"use client";

import * as motion from "motion/react-client";
import Link from "next/link";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecentPick } from "@/types/user-responses";

interface RecentPicksProps {
  readonly picks: RecentPick[];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function RecentPicks({ picks }: RecentPicksProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Recent Picks
          {picks.length > 0 && (
            <span className="text-muted-foreground ml-1 font-normal">({String(picks.length)})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {picks.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No picks yet</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {picks.map((pick, index) => (
              <motion.div
                key={pick.session_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.05, duration: 0.3 }}
              >
                <Link
                  href={`/database/${pick.media_id}`}
                  className="hover:bg-accent/50 flex gap-3 rounded-lg border p-2 transition-colors"
                >
                  <MediaPoster
                    posterUrl={pick.poster_url}
                    title={pick.title}
                    className="h-16 w-11 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="truncate text-sm font-medium">{pick.title}</h4>
                      {pick.avgScore !== null && (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none font-bold ${
                            pick.avgScore >= 7
                              ? "bg-emerald-500/15 text-emerald-500"
                              : "bg-red-500/15 text-red-500"
                          }`}
                        >
                          {pick.avgScore >= 7 ? "W" : "L"}
                        </span>
                      )}
                    </div>
                    <MediaTypeBadge type={pick.type} />
                    <p className="text-muted-foreground mt-1 text-xs">
                      {pick.date_watched === null ? "Date unknown" : formatDate(pick.date_watched)}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
