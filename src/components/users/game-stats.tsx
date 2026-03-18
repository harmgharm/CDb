"use client";

/**
 * UserGameStats — Game performance section for user profiles
 *
 * Shows poster reveal game stats: hero metrics + recent game history.
 */

import {
  FlameIcon,
  Gamepad2Icon,
  HashIcon,
  ShieldCheckIcon,
  TargetIcon,
  TimerIcon,
  TrophyIcon,
  ZapIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";

import { HeroStat } from "@/components/stats/hero-stat";
import { StatsSection } from "@/components/stats/stats-section";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserGameStats } from "@/hooks/use-users";
import type { UserRecentGame } from "@/types/user-responses";

interface UserGameStatsProps {
  readonly userId: string;
}

function GameStatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-12 rounded-lg" />
    </div>
  );
}

function formatGuessTime(ms: number): string {
  if (ms === 0) return "—";
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const DIFFICULTY_LABELS: Record<string, string> = {
  normal: "Normal",
  hard: "Hard",
};

const MODE_LABELS: Record<string, string> = {
  solo: "Solo",
  multiplayer: "Multi",
};

function RecentGameRow({ game, index }: Readonly<{ game: UserRecentGame; index: number }>) {
  const accuracy =
    game.roundCount > 0 ? Math.round((game.correctCount / game.roundCount) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
    >
      <Link
        href={
          game.mode === "multiplayer" ? `/play/poster-reveal/${game.gameId}` : "/play/poster-reveal"
        }
        className="bg-card hover:bg-accent/50 flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
      >
        {/* Result indicator */}
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            game.isWinner ? "bg-yellow-500/15 text-yellow-500" : "bg-muted text-muted-foreground"
          }`}
        >
          {game.isWinner ? "W" : "—"}
        </div>

        {/* Game info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{String(game.totalScore)} pts</span>
            <Badge variant="outline" className="text-[10px]">
              {MODE_LABELS[game.mode]}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {DIFFICULTY_LABELS[game.difficulty]}
            </Badge>
            {game.isRanked && (
              <Badge className="border-emerald-500/25 bg-emerald-500/15 text-[10px] text-emerald-500 hover:bg-emerald-500/15">
                <ShieldCheckIcon className="mr-0.5 size-2.5" />
                Ranked
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {String(game.correctCount)}/{String(game.roundCount)} correct ({String(accuracy)}%)
            {game.finishedAt !== null && ` · ${formatDate(game.finishedAt)}`}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

export function UserGameStats({ userId }: UserGameStatsProps) {
  const { data: stats, isLoading } = useUserGameStats(userId);

  if (isLoading) return <GameStatsSkeleton />;

  if (stats === undefined || stats.gamesPlayed === 0) {
    return null;
  }

  const winRate =
    stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Gamepad2Icon className="text-muted-foreground size-5" />
        <h2 className="text-lg font-semibold">Poster Reveal</h2>
      </div>

      {/* Hero stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat
          label="Games Played"
          value={stats.gamesPlayed}
          icon={<Gamepad2Icon className="size-5" />}
          color="bg-violet-500/15 text-violet-500"
          index={0}
        />
        <HeroStat
          label="Win Rate"
          value={winRate}
          suffix="%"
          icon={<TrophyIcon className="size-5" />}
          color="bg-yellow-500/15 text-yellow-500"
          index={1}
        />
        <HeroStat
          label="Best Streak"
          value={stats.bestStreak}
          icon={<FlameIcon className="size-5" />}
          color="bg-orange-500/15 text-orange-500"
          index={2}
        />
        <HeroStat
          label="Avg Guess Time"
          value={formatGuessTime(stats.avgGuessTimeMs)}
          icon={<TimerIcon className="size-5" />}
          color="bg-cyan-500/15 text-cyan-500"
          index={3}
        />
      </div>

      {/* Best scores + ranks */}
      <StatsSection title="Ranked Best Scores" icon={<ZapIcon className="size-4" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <BestScoreCard
            label="Normal"
            score={stats.bestScoreNormal}
            rank={stats.globalRankNormal}
          />
          <BestScoreCard label="Hard" score={stats.bestScoreHard} rank={stats.globalRankHard} />
        </div>
      </StatsSection>

      {/* Additional stats */}
      <StatsSection title="Game Details" icon={<TargetIcon className="size-4" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15">
              <TargetIcon className="size-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Rounds Won</p>
              <p className="text-lg font-bold">{String(stats.roundsWon)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15">
              <Gamepad2Icon className="size-4 text-violet-500" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Games Won</p>
              <p className="text-lg font-bold">{String(stats.gamesWon)}</p>
            </div>
          </div>
        </div>
      </StatsSection>

      {/* Recent games */}
      {stats.recentGames.length > 0 && (
        <StatsSection title="Recent Games" icon={<Gamepad2Icon className="size-4" />}>
          <div className="space-y-2">
            {stats.recentGames.map((game, index) => (
              <RecentGameRow key={game.gameId} game={game} index={index} />
            ))}
          </div>
        </StatsSection>
      )}
    </div>
  );
}

function BestScoreCard({
  label,
  score,
  rank,
}: Readonly<{ label: string; score: number | null; rank: number | null }>) {
  return (
    <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-yellow-500/15">
        <TrophyIcon className="size-4 text-yellow-500" />
      </div>
      <div className="flex-1">
        <p className="text-muted-foreground text-xs">Best ({label})</p>
        <p className="text-lg font-bold tabular-nums">{score === null ? "—" : String(score)}</p>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1">
          <HashIcon className="text-muted-foreground size-3" />
          <span className="text-sm font-medium tabular-nums">
            {rank === null ? "—" : String(rank)}
          </span>
        </div>
        <p className="text-muted-foreground text-[10px]">rank</p>
      </div>
    </div>
  );
}
