"use client";

/**
 * PlayPageContent — Main orchestrator for the /play/poster-reveal page
 *
 * State machine: idle → playing → (game handles its own result state)
 */

import { Gamepad2Icon, UsersIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { GameLeaderboard } from "@/components/games/game-leaderboard";
import { SoloGame } from "@/components/games/solo-game";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateGame, useGameMediaOptions } from "@/hooks/use-games";
import type { GameSessionResponse } from "@/types/game-responses";

type PageState = "idle" | "playing";

export function PlayPageContent() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("idle");
  const [activeGame, setActiveGame] = useState<GameSessionResponse | null>(null);
  const [difficulty, setDifficulty] = useState<"normal" | "hard">("normal");
  const [roundCount, setRoundCount] = useState("5");
  const { createGame, isCreating, error } = useCreateGame();
  const { data: mediaData } = useGameMediaOptions();

  const handleStartSolo = useCallback(async () => {
    const game = await createGame({
      mode: "solo",
      difficulty,
      roundCount: Number(roundCount),
    });

    if (game !== null) {
      setActiveGame(game);
      setPageState("playing");
    }
  }, [createGame, difficulty, roundCount]);

  const handleStartMultiplayer = useCallback(async () => {
    const game = await createGame({
      mode: "multiplayer",
      difficulty,
      roundCount: Number(roundCount),
    });

    if (game !== null) {
      router.push(`/play/poster-reveal/${game.id}`);
    }
  }, [createGame, difficulty, roundCount, router]);

  const handlePlayAgain = useCallback(() => {
    setActiveGame(null);
    setPageState("idle");
  }, []);

  if (pageState === "playing" && activeGame !== null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <SoloGame
          gameId={activeGame.id}
          mediaOptions={mediaData?.items ?? []}
          onPlayAgain={handlePlayAgain}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" as const }}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <Gamepad2Icon className="text-primary mx-auto mb-3 size-12" />
          <h1 className="text-3xl font-bold">Poster Reveal</h1>
          <p className="text-muted-foreground mt-2">
            A blurred poster slowly reveals itself. Guess the movie, show, or anime before time runs
            out!
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Game setup */}
          <Card>
            <CardHeader>
              <CardTitle>New Game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Difficulty */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Difficulty</label>
                <Select
                  value={difficulty}
                  onValueChange={(value) => {
                    setDifficulty(value as "normal" | "hard");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal — From your database</SelectItem>
                    <SelectItem value="hard">Hard — Mixed with popular titles</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {difficulty === "normal"
                    ? "Posters from movies/shows your group has watched"
                    : "Mixed pool including popular titles from TMDB"}
                </p>
              </div>

              {/* Round count */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Rounds</label>
                <Select value={roundCount} onValueChange={setRoundCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 rounds</SelectItem>
                    <SelectItem value="5">5 rounds</SelectItem>
                    <SelectItem value="10">10 rounds</SelectItem>
                    <SelectItem value="15">15 rounds</SelectItem>
                    <SelectItem value="20">20 rounds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mode tabs */}
              <Tabs defaultValue="solo" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="solo" className="flex-1">
                    <Gamepad2Icon className="mr-1.5 size-4" />
                    Solo
                  </TabsTrigger>
                  <TabsTrigger value="multiplayer" className="flex-1">
                    <UsersIcon className="mr-1.5 size-4" />
                    Multiplayer
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="solo" className="mt-4">
                  <Button
                    onClick={() => {
                      void handleStartSolo();
                    }}
                    disabled={isCreating}
                    size="lg"
                    className="w-full"
                  >
                    {isCreating ? "Starting..." : "Start Solo Game"}
                  </Button>
                </TabsContent>
                <TabsContent value="multiplayer" className="mt-4 space-y-3">
                  <p className="text-muted-foreground text-xs">
                    Create a lobby and invite friends to compete. First correct guess each round
                    earns a bonus!
                  </p>
                  <Button
                    onClick={() => {
                      void handleStartMultiplayer();
                    }}
                    disabled={isCreating}
                    size="lg"
                    className="w-full"
                  >
                    {isCreating ? "Creating..." : "Create Multiplayer Lobby"}
                  </Button>
                </TabsContent>
              </Tabs>

              {error !== null && <p className="text-sm text-red-500">{error}</p>}
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <GameLeaderboard />
        </div>
      </motion.div>
    </div>
  );
}
