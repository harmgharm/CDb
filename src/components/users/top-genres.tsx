"use client";

import * as motion from "motion/react-client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GenreCount } from "@/types/user-responses";

interface TopGenresProps {
  readonly genres: GenreCount[];
}

export function TopGenres({ genres }: TopGenresProps) {
  const firstGenre = genres[0];
  const maxCount = firstGenre === undefined ? 1 : firstGenre.count;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Top Genres</CardTitle>
      </CardHeader>
      <CardContent>
        {genres.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No genres yet</p>
        ) : (
          <div className="space-y-2">
            {genres.map((genre, index) => (
              <motion.div
                key={genre.genre}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.05, duration: 0.3 }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="bg-primary/20 h-2 rounded-full"
                    style={{ width: `${String(Math.max((genre.count / maxCount) * 60, 8))}px` }}
                  />
                  <span className="text-sm">{genre.genre}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {String(genre.count)}
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
