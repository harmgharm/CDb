"use client";

/**
 * MultiplayerResult — Final standings and stats for a multiplayer game
 *
 * "Play Again" creates a rematch lobby with the same settings.
 * Other players receive a "rematch-created" event and can join the new lobby.
 */

import { useChannel } from "ably/react";
import {
  ClockIcon,
  FlameIcon,
  Loader2Icon,
  ShieldCheckIcon,
  ShieldOffIcon,
  TargetIcon,
  TrophyIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { RoundBreakdownRow } from "@/components/games/round-breakdown-row";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRematch } from "@/hooks/use-games";
import { getClientGameConfig } from "@/lib/games/client-config";
import type {
  GamePlayerResponse,
  GameSessionResponse,
  RematchCreatedEvent,
} from "@/types/game-responses";

interface MultiplayerResultProps {
  readonly game: GameSessionResponse;
}

function getInitials(displayName: string | null, username: string): string {
  const name = displayName ?? username;
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const MEDAL_STYLES: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-yellow-500/20", text: "text-yellow-500", label: "1st" },
  2: { bg: "bg-gray-400/20", text: "text-gray-400", label: "2nd" },
  3: { bg: "bg-amber-600/20", text: "text-amber-600", label: "3rd" },
};

export function MultiplayerResult({ game }: MultiplayerResultProps) {
  const { user } = useAuth();
  const router = useRouter();
  const gameConfig = getClientGameConfig(game.gameType);
  const basePath = gameConfig?.basePath ?? "/play";
  const { createRematch, isCreating } = useRematch();
  const [rematchGameId, setRematchGameId] = useState<string | null>(null);
  const [rematchCreator, setRematchCreator] = useState<string | null>(null);

  const standings = (game.players ?? []).toSorted((a, b) => b.totalScore - a.totalScore);

  // Current user stats
  const myStats = standings.find((s) => s.userId === user?.id) ?? null;
  const myRank = standings.findIndex((s) => s.userId === user?.id) + 1;

  // Listen for rematch-created event from other players
  useChannel({ channelName: `game:${game.id}` }, "rematch-created", (message) => {
    const event = message.data as RematchCreatedEvent;
    // Ignore our own rematch events
    if (event.createdBy.userId === user?.id) return;
    setRematchGameId(event.newGameId);
    const name = event.createdBy.displayName ?? event.createdBy.username;
    setRematchCreator(name);
    toast.info(`${name} wants to play again!`);
  });

  const handlePlayAgain = useCallback(async () => {
    // If a rematch already exists (created by someone else), join it
    if (rematchGameId !== null) {
      router.push(`${basePath}/${rematchGameId}`);
      return;
    }

    // Create a new rematch
    const newGameId = await createRematch(game.id);
    if (newGameId !== null) {
      router.push(`${basePath}/${newGameId}`);
    }
  }, [basePath, createRematch, game.id, rematchGameId, router]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" as const }}
      className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-4 py-8"
    >
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold">Game Over</h1>
        {game.isRanked ? (
          <Badge className="border-emerald-500/25 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">
            <ShieldCheckIcon className="mr-1 size-3" />
            Ranked
          </Badge>
        ) : (
          <Badge variant="secondary">
            <ShieldOffIcon className="mr-1 size-3" />
            Unranked
          </Badge>
        )}
      </div>

      {/* Winner announcement */}
      {standings[0] !== undefined && (
        <WinnerBanner winner={standings[0]} isCurrentUser={standings[0].userId === user?.id} />
      )}

      {/* Current user stat cards */}
      {myStats !== null && (
        <UserStatCards stats={myStats} rank={myRank} roundCount={game.roundCount} />
      )}

      {/* Full standings */}
      <div className="w-full">
        <h2 className="mb-3 text-lg font-semibold">Final Standings</h2>
        <div className="space-y-2">
          {standings.map((player, index) => {
            const rank = index + 1;
            const medal = MEDAL_STYLES[rank];
            const isCurrentUser = player.userId === user?.id;

            return (
              <motion.div
                key={player.userId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.3 + index * 0.1,
                  duration: 0.3,
                  ease: "easeOut" as const,
                }}
                className={`bg-card flex items-center gap-3 rounded-lg border p-3 ${
                  isCurrentUser ? "border-primary/50 ring-primary/20 ring-1" : ""
                }`}
              >
                {/* Rank badge */}
                <div
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                    medal === undefined
                      ? "bg-muted text-muted-foreground"
                      : `${medal.bg} ${medal.text}`
                  }`}
                >
                  {medal === undefined ? String(rank) : medal.label}
                </div>

                {/* Avatar */}
                <Avatar className="size-8">
                  <AvatarImage
                    src={player.avatarUrl ?? undefined}
                    alt={player.displayName ?? player.username}
                  />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(player.displayName, player.username)}
                  </AvatarFallback>
                </Avatar>

                {/* Name */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {player.displayName ?? player.username}
                    {isCurrentUser && <span className="text-muted-foreground ml-1">(you)</span>}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {String(player.roundsWon)} round{player.roundsWon === 1 ? "" : "s"} won
                  </p>
                </div>

                {/* Score */}
                <p className="text-lg font-bold tabular-nums">{String(player.totalScore)}</p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Round breakdown */}
      <RoundBreakdown game={game} standings={standings} />

      {/* Rematch banner — shown when another player created a rematch */}
      {rematchGameId !== null && rematchCreator !== null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" as const }}
          className="border-primary/50 bg-primary/5 w-full rounded-lg border p-4 text-center"
        >
          <p className="text-sm font-medium">{rematchCreator} started a new lobby!</p>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          size="lg"
          onClick={() => {
            void handlePlayAgain();
          }}
          disabled={isCreating}
        >
          {isCreating && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          <PlayAgainLabel isCreating={isCreating} hasRematch={rematchGameId !== null} />
        </Button>
        <Link href="/play">
          <Button variant="outline" size="lg">
            Back to Games
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

function PlayAgainLabel({
  isCreating,
  hasRematch,
}: Readonly<{ isCreating: boolean; hasRematch: boolean }>) {
  if (isCreating) return "Creating Lobby...";
  if (hasRematch) return "Join Rematch";
  return "Play Again";
}

function WinnerBanner({
  winner,
  isCurrentUser,
}: Readonly<{ winner: GamePlayerResponse; isCurrentUser: boolean }>) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" as const }}
      className="flex flex-col items-center gap-2"
    >
      <TrophyIcon className="size-10 text-yellow-500" />
      <p className="text-lg font-semibold">
        {isCurrentUser ? "You win!" : `${winner.displayName ?? winner.username} wins!`}
      </p>
      <Badge variant="secondary" className="text-base">
        {String(winner.totalScore)} pts
      </Badge>
    </motion.div>
  );
}

function UserStatCards({
  stats,
  rank,
  roundCount,
}: Readonly<{ stats: GamePlayerResponse; rank: number; roundCount: number }>) {
  const cards = [
    {
      icon: TrophyIcon,
      label: "Your Rank",
      value: `#${String(rank)}`,
      color: "text-yellow-500",
    },
    {
      icon: TargetIcon,
      label: "Correct",
      value: `${String(stats.roundsWon)}/${String(roundCount)}`,
      color: "text-green-500",
    },
    {
      icon: FlameIcon,
      label: "Score",
      value: String(stats.totalScore),
      color: "text-orange-500",
    },
    {
      icon: ClockIcon,
      label: "Streak",
      value: String(stats.currentStreak),
      color: "text-blue-500",
    },
  ];

  return (
    <div className="grid w-full grid-cols-4 gap-3">
      {cards.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.1 + index * 0.1,
            duration: 0.3,
            ease: "easeOut" as const,
          }}
        >
          <Card>
            <CardContent className="flex flex-col items-center gap-1 py-3">
              <stat.icon className={`size-4 ${stat.color}`} />
              <p className="text-lg font-bold tabular-nums">{stat.value}</p>
              <p className="text-muted-foreground text-[10px]">{stat.label}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function RoundBreakdown({
  game,
  standings,
}: Readonly<{ game: GameSessionResponse; standings: GamePlayerResponse[] }>) {
  const [openRounds, setOpenRounds] = useState<Set<number>>(new Set());

  const toggleRound = useCallback((roundNumber: number) => {
    setOpenRounds((previous) => {
      const next = new Set(previous);
      if (next.has(roundNumber)) {
        next.delete(roundNumber);
      } else {
        next.add(roundNumber);
      }
      return next;
    });
  }, []);

  return (
    <div className="w-full">
      <h2 className="mb-3 text-lg font-semibold">Round Breakdown</h2>
      <div className="space-y-2">
        {game.rounds.map((round, index) => (
          <RoundBreakdownRow
            key={round.id}
            round={round}
            index={index}
            standings={standings}
            gameType={game.gameType}
            isOpen={openRounds.has(index)}
            onToggle={() => {
              toggleRound(index);
            }}
          />
        ))}
      </div>
    </div>
  );
}
