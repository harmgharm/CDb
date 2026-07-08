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
import { MultiplayerGame as YearGuessMultiplayerGame } from "@/components/games/year-guess/multiplayer-game";
import { useAuth } from "@/components/providers/auth-provider";
import { useGameMediaOptions, useGameState, useJoinGame, useLeaveLobby } from "@/hooks/use-games";
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
  year_guess: YearGuessMultiplayerGame,
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
  const { leaveLobby } = useLeaveLobby();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const joinAttemptedRef = useRef(false);
  const [joinAttempted, setJoinAttempted] = useState(false);
  const [hostDisconnected, setHostDisconnected] = useState(false);
  // Track game status in a ref so useEffect cleanup and beforeunload can read
  // the latest value without re-running the effect on every status change.
  const gameStatusRef = useRef(game?.status);
  // Track whether the host was ever seen online so we only treat their
  // *departure* from presence as a disconnect (not initial absence).
  const hostWasOnlineRef = useRef(false);

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
    const data = update.data as
      | { userId?: string; username?: string; displayName?: string | null }
      | undefined;

    // Track when the host first appears in presence
    const isJoinAction =
      update.action === "enter" || update.action === "present" || update.action === "update";
    if (isJoinAction && data?.userId === game?.createdByUserId) {
      hostWasOnlineRef.current = true;
    }

    if (update.action === "leave" || update.action === "absent") {
      // Ignore our own leave events (e.g. during page navigation / remount)
      if (data?.userId === user?.id) return;

      // Host left presence during lobby — covers ungraceful disconnects
      // (network loss, browser crash) where the leave API never fires.
      const isHostLeaving =
        data?.userId === game?.createdByUserId &&
        game?.status === "lobby" &&
        hostWasOnlineRef.current;
      if (isHostLeaving) {
        setHostDisconnected(true);
        playPlayerDisconnectedSound();
        toast.error("The host disconnected");
        return;
      }

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

  // Auto-join if user navigates to lobby URL but isn't a player yet.
  // This handles two cases:
  // 1. Game loaded but user isn't in the player list (e.g. shared link, game visible)
  // 2. GET /api/games/[id] returned 403 because user isn't in game_players yet
  useEffect(() => {
    if (user === null || joinAttemptedRef.current) return;

    const attemptJoin = () => {
      joinAttemptedRef.current = true;
      void (async () => {
        const success = await joinGame(gameId);
        if (success) {
          await mutate();
        } else {
          setJoinAttempted(true);
        }
      })();
    };

    // Case 1: game loaded successfully but user isn't a player
    if (game?.status === "lobby") {
      const isPlayer = game.players?.some((p) => p.userId === user.id) ?? false;
      if (!isPlayer) {
        attemptJoin();
      }
      return;
    }

    // Case 2: 403 error — user isn't in game_players, so try joining first
    const errorMessage = gameError instanceof Error ? gameError.message : "";
    if (errorMessage.includes("not in this game")) {
      attemptJoin();
    }
  }, [game, gameError, gameId, joinGame, mutate, user]);

  // Keep status ref in sync so cleanup callbacks read the latest value
  useEffect(() => {
    gameStatusRef.current = game?.status;
  }, [game?.status]);

  // Leave lobby on unmount (SPA navigation) and beforeunload (tab close / hard refresh).
  // Only fires while in "lobby" — once the game transitions to "active", we stop.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (gameStatusRef.current === "lobby") {
        // sendBeacon is more reliable than fetch during page teardown
        navigator.sendBeacon(`/api/games/${gameId}/leave`);
      }
    };

    globalThis.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      globalThis.removeEventListener("beforeunload", handleBeforeUnload);
      if (gameStatusRef.current === "lobby") {
        leaveLobby(gameId);
      }
    };
  }, [gameId, leaveLobby]);

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

  // Error state — but don't show error while auto-join is being attempted
  if (gameError !== undefined || game === undefined) {
    const errorMessage = gameError instanceof Error ? gameError.message : "";
    const isAutoJoinable = errorMessage.includes("not in this game") && !joinAttempted;

    if (isJoining || isAutoJoinable) {
      return (
        <div className="flex items-center justify-center gap-2 py-20">
          <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
          <span className="text-muted-foreground">Joining game...</span>
        </div>
      );
    }

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
          hostDisconnected={hostDisconnected}
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

  // Abandoned — nobody finished it, so there's no result to show
  if (game.status === "abandoned") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">This game was abandoned before anyone finished it.</p>
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

  // Finished (only remaining status after lobby/active/abandoned checks above)
  return <MultiplayerResult game={game} />;
}
