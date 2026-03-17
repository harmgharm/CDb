"use client";

/**
 * GameLeaderboard — Leaderboard table with scores and stats
 */

import { TrophyIcon } from "lucide-react";
import * as motion from "motion/react-client";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard } from "@/hooks/use-games";

export function GameLeaderboard() {
  const { data, isLoading } = useLeaderboard();
  const { user } = useAuth();

  if (isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (data === undefined || data.entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrophyIcon className="size-5 text-yellow-500" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No games played yet. Be the first!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrophyIcon className="size-5 text-yellow-500" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.entries.map((entry, index) => {
            const isCurrentUser = entry.userId === user?.id;
            return (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: index * 0.05,
                  duration: 0.2,
                  ease: "easeOut" as const,
                }}
                className={`flex items-center gap-3 px-4 py-3 ${
                  isCurrentUser ? "bg-primary/5" : ""
                }`}
              >
                {/* Rank */}
                <RankBadge rank={entry.rank} />

                {/* Avatar + Name */}
                <Avatar className="size-8">
                  <AvatarImage
                    src={entry.avatarUrl ?? undefined}
                    alt={entry.displayName ?? entry.username}
                  />
                  <AvatarFallback className="text-xs">
                    {(entry.displayName ?? entry.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${isCurrentUser ? "font-bold" : "font-medium"}`}>
                    {entry.displayName ?? entry.username}
                    {isCurrentUser && (
                      <span className="text-muted-foreground ml-1 text-xs">(you)</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {String(entry.gamesPlayed)} games · {String(entry.roundsWon)} rounds won
                  </p>
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">{String(entry.totalScore)}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    🔥 {String(entry.bestStreak)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RankBadge({ rank }: Readonly<{ rank: number }>) {
  const medalColors: Record<number, string> = {
    1: "bg-yellow-500 text-yellow-950",
    2: "bg-gray-300 text-gray-800",
    3: "bg-amber-600 text-amber-950",
  };

  const colorClass = medalColors[rank] ?? "bg-muted text-muted-foreground";

  return (
    <div
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colorClass}`}
    >
      {String(rank)}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
