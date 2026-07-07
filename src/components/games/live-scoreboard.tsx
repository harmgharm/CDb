"use client";

/**
 * LiveScoreboard — Real-time player scores for multiplayer games
 *
 * Updates when player-guessed events arrive via Ably.
 */

import { TrophyIcon, WifiOffIcon } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { GamePlayerResponse } from "@/types/game-responses";

interface LiveScoreboardProps {
  readonly players: GamePlayerResponse[];
  readonly onlineUserIds?: Set<string>;
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

const RANK_COLORS: Record<number, string> = {
  1: "text-cdb-star",
  2: "text-gray-400",
  3: "text-amber-600",
};

export function LiveScoreboard({ players, onlineUserIds }: LiveScoreboardProps) {
  const { user } = useAuth();

  const sorted = players.toSorted((a, b) => b.totalScore - a.totalScore);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrophyIcon className="size-4" />
          Scoreboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((player, index) => {
          const rank = index + 1;
          const isCurrentUser = player.userId === user?.id;
          const isOnline = onlineUserIds === undefined || onlineUserIds.has(player.userId);

          return (
            <div
              key={player.userId}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                isCurrentUser ? "bg-[color-mix(in_oklch,var(--cdb-marquee)_10%,transparent)]" : ""
              } ${isOnline ? "" : "opacity-50"}`}
            >
              {/* Rank */}
              <span
                className={`w-5 text-center text-xs font-bold ${
                  RANK_COLORS[rank] ?? "text-muted-foreground"
                }`}
              >
                {String(rank)}
              </span>

              {/* Avatar */}
              <div className="relative">
                <Avatar className="size-6">
                  <AvatarImage
                    src={player.avatarUrl ?? undefined}
                    alt={player.displayName ?? player.username}
                  />
                  <AvatarFallback className="text-[9px]">
                    {getInitials(player.displayName, player.username)}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Name + disconnect icon */}
              <span className={`flex-1 truncate text-xs ${isCurrentUser ? "font-semibold" : ""}`}>
                {player.displayName ?? player.username}
              </span>

              {!isOnline && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <WifiOffIcon className="size-3 text-red-400" />
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>Disconnected</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Score */}
              <span className="text-xs font-bold tabular-nums">{String(player.totalScore)}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
