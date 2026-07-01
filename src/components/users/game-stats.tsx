"use client";

/**
 * UserGameStats — Game performance section for user profiles
 *
 * One card per game type (Poster Reveal / Rating Guesser / Year Guesser),
 * matching the kit's cdb-game-section: an icon-tinted header, a hero-stats row,
 * then inline sub-sections — Ranked best scores, Game details, and Recent games
 * (collapsed to a few rows with a show-more toggle).
 */

import {
  ArrowLeftIcon,
  ArrowRightIcon,
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
import { useState } from "react";

import { HeroStat } from "@/components/stats/hero-stat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserGameStats } from "@/hooks/use-users";
import type { GameType } from "@/lib/db/types";
import { getClientGameConfig } from "@/lib/games/client-config";
import type { GameTypeStats, UserRecentGame } from "@/types/user-responses";

interface UserGameStatsProps {
  readonly userId: string;
}

/** Recent games collapse to this many rows; the rest sit behind a toggle. */
const RECENT_COLLAPSED = 3;

/** Per-game icon-chip tint (brand tokens; cherry stays reserved for live MP). */
const GAME_TONE: Record<GameType, string> = {
  poster_reveal: "bg-amber-500/15 text-amber-500",
  rating_guess: "bg-rose-500/15 text-rose-500",
  year_guess: "bg-[color-mix(in_oklch,var(--cdb-tv)_18%,transparent)] text-cdb-tv",
};

function GameStatsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-64 rounded-xl" />
      ))}
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

/** Kit's cdb-sub-head: an uppercase micro-label with a small leading icon. */
function SubHead({
  icon,
  children,
}: Readonly<{ icon: React.ReactNode; children: React.ReactNode }>) {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.07em] text-[var(--fg-dim)] uppercase">
      {icon}
      {children}
    </div>
  );
}

function RecentGameRow({
  game,
  index,
  basePath,
}: Readonly<{ game: UserRecentGame; index: number; basePath: string }>) {
  const isRatingGuess = game.gameType === "rating_guess";

  const accuracy =
    game.roundCount > 0 ? Math.round((game.correctCount / game.roundCount) * 100) : 0;
  const accuracyText = isRatingGuess
    ? `Avg diff: ${String(game.avgDifference ?? 0)}`
    : `${String(game.correctCount)}/${String(game.roundCount)} correct (${String(accuracy)}%)`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, RECENT_COLLAPSED) * 0.05, duration: 0.2 }}
    >
      <Link
        href={game.mode === "multiplayer" ? `${basePath}/${game.gameId}` : basePath}
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
            {accuracyText}
            {game.finishedAt !== null && ` · ${formatDate(game.finishedAt)}`}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

function RecentGamesList({
  games,
  basePath,
}: Readonly<{ games: UserRecentGame[]; basePath: string }>) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? games : games.slice(0, RECENT_COLLAPSED);
  const hiddenCount = games.length - RECENT_COLLAPSED;
  const canExpand = hiddenCount > 0;

  return (
    <div className="space-y-2">
      {visible.map((game, index) => (
        <RecentGameRow key={game.gameId} game={game} index={index} basePath={basePath} />
      ))}
      {canExpand && (
        <div className="flex justify-center pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              setExpanded((previous) => !previous);
            }}
          >
            {expanded ? (
              <>
                <ArrowLeftIcon className="mr-1 size-3" />
                Show less
              </>
            ) : (
              <>
                <ArrowRightIcon className="mr-1 size-3" />
                See all {String(hiddenCount)} more
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function GameTypeStatsSection({
  gameType,
  stats,
}: Readonly<{ gameType: GameType; stats: GameTypeStats }>) {
  const config = getClientGameConfig(gameType);
  const displayName = config?.displayName ?? gameType;
  const basePath = config?.basePath ?? "/play";
  const Icon = config?.icon ?? Gamepad2Icon;

  const winRate =
    stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  return (
    <Card className="gap-3.5 border-[var(--border)] bg-[var(--bg-elev-1)] p-5">
      {/* Section header — icon chip + title */}
      <div className="flex items-center gap-2.5">
        <div
          className={`flex size-8 items-center justify-center rounded-md ${GAME_TONE[gameType]}`}
        >
          <Icon className="size-4" />
        </div>
        <h2 className="text-lg font-semibold">{displayName}</h2>
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

      {/* Ranked best scores */}
      <SubHead icon={<ZapIcon className="size-3" />}>Ranked best scores</SubHead>
      <div className="grid gap-4 sm:grid-cols-2">
        <BestScoreCard label="Normal" score={stats.bestScoreNormal} rank={stats.globalRankNormal} />
        <BestScoreCard label="Hard" score={stats.bestScoreHard} rank={stats.globalRankHard} />
      </div>

      {/* Game details (kept — the kit drops these) */}
      <SubHead icon={<TargetIcon className="size-3" />}>Game details</SubHead>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15">
            <TargetIcon className="size-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Rounds Won</p>
            <p className="text-lg font-bold">{String(stats.roundsWon)}</p>
          </div>
        </div>
        <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15">
            <Gamepad2Icon className="size-4 text-violet-500" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Games Won</p>
            <p className="text-lg font-bold">{String(stats.gamesWon)}</p>
          </div>
        </div>
      </div>

      {/* Recent games (inline, collapsed to a few rows) */}
      {stats.recentGames.length > 0 && (
        <>
          <SubHead icon={<Gamepad2Icon className="size-3" />}>Recent games</SubHead>
          <RecentGamesList games={stats.recentGames} basePath={basePath} />
        </>
      )}
    </Card>
  );
}

export function UserGameStats({ userId }: UserGameStatsProps) {
  const { data: stats, isLoading } = useUserGameStats(userId);

  if (isLoading) return <GameStatsSkeleton />;

  if (stats === undefined) {
    return null;
  }

  const hasAnyGames =
    stats.posterReveal !== null || stats.ratingGuess !== null || stats.yearGuess !== null;
  if (!hasAnyGames) {
    return null;
  }

  return (
    <div className="space-y-6">
      {stats.posterReveal !== null && (
        <GameTypeStatsSection gameType="poster_reveal" stats={stats.posterReveal} />
      )}
      {stats.ratingGuess !== null && (
        <GameTypeStatsSection gameType="rating_guess" stats={stats.ratingGuess} />
      )}
      {stats.yearGuess !== null && (
        <GameTypeStatsSection gameType="year_guess" stats={stats.yearGuess} />
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
