"use client";

/**
 * GameHubContent — Landing page for /play showing available game types
 */

import { Gamepad2Icon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllGameConfigs } from "@/lib/games/client-config";

export function GameHubContent() {
  const games = getAllGameConfigs();

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
          <h1 className="text-3xl font-bold">Games</h1>
          <p className="text-muted-foreground mt-2">Challenge yourself or compete with friends</p>
        </div>

        {/* Game cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Link key={game.basePath} href={game.basePath}>
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <game.icon className="text-primary size-6" />
                    <CardTitle className="text-lg">{game.displayName}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{game.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
