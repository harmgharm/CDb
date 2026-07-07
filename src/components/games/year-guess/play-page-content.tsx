"use client";

/**
 * PlayPageContent — Main orchestrator for the /play/year-guess page
 *
 * State machine: idle → playing → (game handles its own result state)
 */

import {
  CalendarIcon,
  Gamepad2Icon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UsersIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { GameLeaderboard } from "@/components/games/game-leaderboard";
import { SoloGame } from "@/components/games/year-guess/solo-game";
import { Badge } from "@/components/ui/badge";
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
import { useCreateGame } from "@/hooks/use-games";
import type { GameDifficulty } from "@/lib/db/types";
import { isRankedGame } from "@/lib/games/ranked-presets";
import type { GameSessionResponse } from "@/types/game-responses";

type PageState = "idle" | "playing";

export function PlayPageContent() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("idle");
  const [activeGame, setActiveGame] = useState<GameSessionResponse | null>(null);
  const [difficulty, setDifficulty] = useState<GameDifficulty>("normal");
  const [roundCount, setRoundCount] = useState("5");
  const [timeLimit, setTimeLimit] = useState("10");
  const { createGame, isCreating, error } = useCreateGame();

  const ranked = useMemo(
    () => isRankedGame("year_guess", difficulty, Number(roundCount)),
    [difficulty, roundCount],
  );

  const handleStartSolo = useCallback(async () => {
    const game = await createGame({
      gameType: "year_guess",
      mode: "solo",
      difficulty,
      roundCount: Number(roundCount),
      timeLimitSeconds: Number(timeLimit),
    });

    if (game !== null) {
      setActiveGame(game);
      setPageState("playing");
    }
  }, [createGame, difficulty, roundCount, timeLimit]);

  const handleStartMultiplayer = useCallback(async () => {
    const game = await createGame({
      gameType: "year_guess",
      mode: "multiplayer",
      difficulty,
      roundCount: Number(roundCount),
      timeLimitSeconds: Number(timeLimit),
    });

    if (game !== null) {
      router.push(`/play/year-guess/${game.id}`);
    }
  }, [createGame, difficulty, roundCount, timeLimit, router]);

  const handlePlayAgain = useCallback(() => {
    setActiveGame(null);
    setPageState("idle");
  }, []);

  if (pageState === "playing" && activeGame !== null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <SoloGame gameId={activeGame.id} onPlayAgain={handlePlayAgain} />
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
        <div className="mb-8 flex flex-col items-center gap-2.5 text-center">
          <span className="text-cdb-marquee flex size-12 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--cdb-marquee)_14%,transparent)]">
            <CalendarIcon className="size-6" />
          </span>
          <h1 className="font-display text-[44px] leading-none">Year Guesser</h1>
          <p className="text-muted-foreground max-w-lg text-sm">
            See a movie, show, or anime and guess when it was released. The closer your guess, the
            more points you earn!
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Game setup */}
          <Card>
            <CardHeader>
              <CardTitle>New game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Difficulty */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Difficulty</label>
                <Select
                  value={difficulty}
                  onValueChange={(value) => {
                    setDifficulty(value as GameDifficulty);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal — Your group&apos;s media</SelectItem>
                    <SelectItem value="hard">Hard — Popular titles (TMDB &amp; MAL)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {difficulty === "normal"
                    ? "Guess the release year for movies/shows your group has tracked"
                    : "Guess the release year for popular titles from TMDB and MyAnimeList"}
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

              {/* Time limit */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Time limit</label>
                <Select value={timeLimit} onValueChange={setTimeLimit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="7">7 seconds</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                    <SelectItem value="12">12 seconds</SelectItem>
                    <SelectItem value="15">15 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ranked indicator */}
              <RankedIndicator ranked={ranked} />

              {/* Mode tabs */}
              <Tabs defaultValue="solo" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger
                    value="solo"
                    className="data-[state=active]:text-cdb-marquee-text dark:data-[state=active]:text-cdb-marquee-text flex-1 data-[state=active]:border-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent"
                  >
                    <Gamepad2Icon className="mr-1.5 size-4" />
                    Solo
                  </TabsTrigger>
                  <TabsTrigger
                    value="multiplayer"
                    className="data-[state=active]:text-cdb-marquee-text dark:data-[state=active]:text-cdb-marquee-text flex-1 data-[state=active]:border-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent"
                  >
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
                    {isCreating ? "Starting..." : "Start solo game"}
                  </Button>
                </TabsContent>
                <TabsContent value="multiplayer" className="mt-4 space-y-3">
                  <p className="text-muted-foreground text-xs">
                    Create a lobby and invite friends to compete. Who knows their release dates
                    best?
                  </p>
                  <Button
                    onClick={() => {
                      void handleStartMultiplayer();
                    }}
                    disabled={isCreating}
                    size="lg"
                    className="w-full"
                  >
                    {isCreating ? "Creating..." : "Create multiplayer lobby"}
                  </Button>
                </TabsContent>
              </Tabs>

              {error !== null && <p className="text-sm text-red-500">{error}</p>}
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <GameLeaderboard gameType="year_guess" />
        </div>
      </motion.div>
    </div>
  );
}

function RankedIndicator({ ranked }: Readonly<{ ranked: boolean }>) {
  return (
    <motion.div
      key={ranked ? "ranked" : "unranked"}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2"
    >
      {ranked ? (
        <>
          <Badge className="text-cdb-marquee-text border-[color-mix(in_oklch,var(--cdb-marquee)_32%,transparent)] bg-[color-mix(in_oklch,var(--cdb-marquee)_16%,transparent)] hover:bg-[color-mix(in_oklch,var(--cdb-marquee)_16%,transparent)]">
            <ShieldCheckIcon className="mr-1 size-3" />
            Ranked
          </Badge>
          <span className="text-muted-foreground text-xs">Score counts toward the leaderboard</span>
        </>
      ) : (
        <>
          <Badge variant="secondary">
            <ShieldOffIcon className="mr-1 size-3" />
            Unranked
          </Badge>
          <span className="text-muted-foreground text-xs">
            Custom settings — scores won&apos;t appear on the leaderboard
          </span>
        </>
      )}
    </motion.div>
  );
}
