"use client";

/**
 * MultiplayerPageContent — Orchestrates lobby → game → results for /play/poster-reveal/[id]
 *
 * Wraps the game channel with ChannelProvider for Ably hooks.
 * Handles auto-join for invited players who navigate to the lobby URL.
 */

import { ChannelProvider, usePresence, usePresenceListener } from "ably/react";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { GameLobby } from "@/components/games/game-lobby";
import { InvitePlayersDialog } from "@/components/games/invite-players-dialog";
import { MultiplayerResult } from "@/components/games/multiplayer-result";
import { MultiplayerGame as PosterRevealMultiplayerGame } from "@/components/games/poster-reveal/multiplayer-game";
import { MultiplayerGame as RatingGuessMultiplayerGame } from "@/components/games/rating-guess/multiplayer-game";
import { useAuth } from "@/components/providers/auth-provider";
import { useGameMediaOptions, useGameState, useJoinGame } from "@/hooks/use-games";
import type { GameType } from "@/lib/db/types";
import { getClientGameConfig } from "@/lib/games/client-config";
import { playPlayerDisconnectedSound } from "@/lib/games/sounds";
import type { MediaListItem } from "@/types/media-responses";

/** Registry of multiplayer game components by game type */
const GAME_COMPONENTS: Record<
  GameType,
  React.ComponentType<{
    gameId: string;
    mediaOptions: MediaListItem[];
    onlineUserIds: Set<string>;
  }>
> = {
  poster_reveal: PosterRevealMultiplayerGame,
  rating_guess: RatingGuessMultiplayerGame,
};

interface MultiplayerPageContentProps {
  readonly gameId: string;
  readonly gameType: GameType;
}

export function MultiplayerPageContent({ gameId, gameType }: MultiplayerPageContentProps) {
  const { user } = useAuth();

  // Don't render Ably hooks until we have auth
  if (user === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  return (
    <ChannelProvider channelName={`game:${gameId}`}>
      <MultiplayerPageInner gameId={gameId} gameType={gameType} />
    </ChannelProvider>
  );
}

function MultiplayerPageInner({
  gameId,
  gameType,
}: Readonly<{ gameId: string; gameType: GameType }>) {
  const gameConfig = getClientGameConfig(gameType);
  const { user } = useAuth();
  const router = useRouter();
  const gameState = useGameState(gameId);
  const { data: game, mutate } = gameState;
  const gameError = gameState.error as unknown;
  const { data: mediaData } = useGameMediaOptions();
  const { joinGame, isJoining } = useJoinGame();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const joinAttemptedRef = useRef(false);

  const channelName = `game:${gameId}`;

  // Enter presence on the game channel so other players can detect us
  usePresence(
    { channelName },
    {
      userId: user?.id ?? "",
      username: user?.username ?? "",
      displayName: user?.displayName ?? null,
    },
  );

  // Track who is online via presence leave/enter events
  const { presenceData } = usePresenceListener({ channelName }, (update) => {
    if (update.action === "leave" || update.action === "absent") {
      const data = update.data as
        | { userId?: string; username?: string; displayName?: string | null }
        | undefined;
      // Ignore our own leave events (e.g. during page navigation / remount)
      if (data?.userId === user?.id) return;
      const name = data?.displayName ?? data?.username ?? "A player";
      toast.info(`${name} disconnected`);
      playPlayerDisconnectedSound();
    }
  });

  const onlineUserIds = useMemo(
    () =>
      new Set(
        presenceData.map((member) => {
          const data = member.data as { userId?: string } | undefined;
          return data?.userId ?? "";
        }),
      ),
    [presenceData],
  );

  // Auto-join if user navigates to lobby URL but isn't a player yet
  useEffect(() => {
    if (
      game === undefined ||
      user === null ||
      joinAttemptedRef.current ||
      game.status !== "lobby"
    ) {
      return;
    }

    const isPlayer = game.players?.some((p) => p.userId === user.id) ?? false;
    if (!isPlayer) {
      joinAttemptedRef.current = true;
      void (async () => {
        const success = await joinGame(gameId);
        if (success) {
          await mutate();
        }
      })();
    }
  }, [game, gameId, joinGame, mutate, user]);

  const handleGameStarted = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Loading state
  if (game === undefined && gameError === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  // Error state
  if (gameError !== undefined || game === undefined) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">Game not found or you don&apos;t have access.</p>
        <button
          onClick={() => {
            router.push(gameConfig?.basePath ?? "/play");
          }}
          className="text-primary text-sm underline"
        >
          Back to {gameConfig?.displayName ?? "Games"}
        </button>
      </div>
    );
  }

  // Joining state
  if (isJoining) {
    return (
      <div className="flex items-center justify-center gap-2 py-20">
        <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
        <span className="text-muted-foreground">Joining game...</span>
      </div>
    );
  }

  // Lobby
  if (game.status === "lobby") {
    return (
      <>
        <GameLobby
          game={game}
          gameDisplayName={gameConfig?.displayName ?? "Game"}
          gameBasePath={gameConfig?.basePath ?? "/play"}
          onGameStarted={() => {
            void handleGameStarted();
          }}
          onOpenInviteDialog={() => {
            setInviteDialogOpen(true);
          }}
          onlineUserIds={onlineUserIds}
        />
        <InvitePlayersDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          gameId={gameId}
          existingPlayers={game.players ?? []}
        />
      </>
    );
  }

  // Active game — delegate to game-type-specific component
  if (game.status === "active") {
    const GameComponent = GAME_COMPONENTS[gameType];
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <GameComponent
          gameId={gameId}
          mediaOptions={mediaData?.items ?? []}
          onlineUserIds={onlineUserIds}
        />
      </div>
    );
  }

  // Finished (only remaining status after lobby/active checks above)
  return <MultiplayerResult game={game} />;
}
