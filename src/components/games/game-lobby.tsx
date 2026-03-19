"use client";

/**
 * GameLobby — Multiplayer lobby showing players, settings, and host controls
 *
 * Uses Ably presence for live player list and channel events for join/leave.
 */

import { useChannel } from "ably/react";
import {
  CheckIcon,
  ClipboardIcon,
  Crown,
  LinkIcon,
  Loader2Icon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UsersIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStartGame } from "@/hooks/use-games";
import { playPlayerJoinedSound, playRoundStartSound } from "@/lib/games/sounds";
import type {
  GamePlayerResponse,
  GameSessionResponse,
  PlayerJoinedEvent,
  PlayerLeftEvent,
} from "@/types/game-responses";

interface GameLobbyProps {
  readonly game: GameSessionResponse;
  readonly gameDisplayName: string;
  readonly gameBasePath: string;
  readonly onGameStarted: () => void;
  readonly onOpenInviteDialog: () => void;
  readonly onlineUserIds: Set<string>;
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

const DIFFICULTY_LABELS: Record<string, string> = {
  normal: "Normal",
  hard: "Hard",
};

export function GameLobby({
  game,
  gameDisplayName,
  gameBasePath,
  onGameStarted,
  onOpenInviteDialog,
  onlineUserIds,
}: GameLobbyProps) {
  const { user } = useAuth();
  const { startGame, isStarting, error: startError } = useStartGame();
  const [copied, setCopied] = useState(false);
  const [players, setPlayers] = useState<GamePlayerResponse[]>(game.players ?? []);

  const isHost = user?.id === game.createdByUserId;
  const channelName = `game:${game.id}`;

  // Listen for player join/leave events
  useChannel({ channelName }, "player-joined", (message) => {
    const event = message.data as PlayerJoinedEvent;
    playPlayerJoinedSound();
    setPlayers((previous) => {
      if (previous.some((p) => p.userId === event.userId)) return previous;
      return [
        ...previous,
        {
          userId: event.userId,
          username: event.username,
          displayName: event.displayName,
          avatarUrl: event.avatarUrl,
          isHost: false,
          joinedAt: new Date().toISOString(),
          totalScore: 0,
          roundsWon: 0,
          currentStreak: 0,
        },
      ];
    });
  });

  useChannel({ channelName }, "player-left", (message) => {
    const event = message.data as PlayerLeftEvent;
    setPlayers((previous) => previous.filter((p) => p.userId !== event.userId));
  });

  useChannel({ channelName }, "game-started", () => {
    playRoundStartSound();
    onGameStarted();
  });

  const handleStart = useCallback(async () => {
    const result = await startGame(game.id);
    if (result !== null) {
      onGameStarted();
    }
  }, [game.id, onGameStarted, startGame]);

  const handleCopyLink = useCallback(async () => {
    const url = `${globalThis.location.origin}${gameBasePath}/${game.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Lobby link copied!");
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [game.id, gameBasePath]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold">{gameDisplayName} Lobby</h1>
        <p className="text-muted-foreground mt-1 text-sm">Waiting for players to join...</p>
      </div>

      {/* Settings summary */}
      <div className="flex items-center justify-center gap-3">
        <Badge variant="secondary">{DIFFICULTY_LABELS[game.difficulty]}</Badge>
        <Badge variant="secondary">
          {String(game.roundCount)} round{game.roundCount === 1 ? "" : "s"}
        </Badge>
        <Badge variant="secondary">{String(players.length)}/10 players</Badge>
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

      {/* Player list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="size-5" />
            Players ({String(players.length)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {players.map((player) => (
              <div key={player.userId} className="flex items-center gap-3 rounded-lg p-2">
                <div className="relative">
                  <Avatar className="size-9">
                    <AvatarImage
                      src={player.avatarUrl ?? undefined}
                      alt={player.displayName ?? player.username}
                    />
                    <AvatarFallback className="text-xs">
                      {getInitials(player.displayName, player.username)}
                    </AvatarFallback>
                  </Avatar>
                  {onlineUserIds.has(player.userId) && (
                    <div className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-900" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {player.displayName ?? player.username}
                    {player.userId === user?.id && (
                      <span className="text-muted-foreground ml-1">(you)</span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">@{player.username}</p>
                </div>
                {player.isHost && (
                  <Badge variant="outline" className="gap-1">
                    <Crown className="size-3" />
                    Host
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {isHost && (
          <Button
            size="lg"
            onClick={() => {
              void handleStart();
            }}
            disabled={isStarting || players.length < 2}
          >
            {isStarting && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            <StartButtonLabel isStarting={isStarting} playerCount={players.length} />
          </Button>
        )}

        {!isHost && (
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm">
              Waiting for the host to start the game...
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              void handleCopyLink();
            }}
          >
            {copied ? (
              <CheckIcon className="mr-1.5 size-4" />
            ) : (
              <LinkIcon className="mr-1.5 size-4" />
            )}
            {copied ? "Copied!" : "Copy Link"}
          </Button>
          {isHost && (
            <Button variant="outline" className="flex-1" onClick={onOpenInviteDialog}>
              <ClipboardIcon className="mr-1.5 size-4" />
              Invite Friends
            </Button>
          )}
        </div>

        {startError !== null && <p className="text-center text-sm text-red-500">{startError}</p>}
      </div>
    </div>
  );
}

const START_BUTTON_LABELS: Record<string, string> = {
  starting: "Starting...",
  needPlayers: "Need at least 2 players",
  ready: "Start Game",
};

function StartButtonLabel({
  isStarting,
  playerCount,
}: Readonly<{ isStarting: boolean; playerCount: number }>) {
  if (isStarting) return START_BUTTON_LABELS.starting;
  if (playerCount < 2) return START_BUTTON_LABELS.needPlayers;
  return START_BUTTON_LABELS.ready;
}
