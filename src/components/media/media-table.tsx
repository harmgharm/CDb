"use client";

import Link from "next/link";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MediaListItem } from "@/types/media-responses";

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(remainder)}m`;
}

function MediaDuration({
  runtime,
  episodes,
}: Readonly<{ runtime: number | null; episodes: number | null }>) {
  if (runtime !== null) {
    return <>{formatRuntime(runtime)}</>;
  }
  if (episodes !== null) {
    return <>{String(episodes)} eps</>;
  }
  return <>—</>;
}

interface MediaTableProps {
  readonly items: MediaListItem[];
}

export function MediaTable({ items }: MediaTableProps) {
  return (
    // The kit's two-shade table: the wrapper/body sits on the darker bg-elev-1,
    // and the header bar is the lighter bg-card (bg-elev-2). Rows inherit the
    // wrapper's elev-1 and lift toward elev-2 on hover, matching cdb-db-table.
    <div className="overflow-hidden rounded-md border bg-[var(--bg-elev-1)]">
      <Table>
        <TableHeader>
          <TableRow className="bg-card hover:bg-card">
            <TableHead className="w-16" />
            <TableHead>Title</TableHead>
            <TableHead className="w-24">Type</TableHead>
            <TableHead className="w-16">Year</TableHead>
            <TableHead className="hidden w-24 sm:table-cell">Genres</TableHead>
            <TableHead className="hidden w-20 sm:table-cell">Runtime</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground py-12 text-center text-sm">
                No media found. Try adjusting your filters.
              </TableCell>
            </TableRow>
          )}
          {items.map((media) => (
            <TableRow
              key={media.id}
              className="group hover:bg-[color-mix(in_oklch,var(--bg-elev-2)_55%,transparent)]"
            >
              <TableCell className="p-2">
                <Link href={`/database/${media.id}`}>
                  <MediaPoster
                    posterUrl={media.poster_url}
                    title={media.title}
                    className="h-12 w-8"
                  />
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/database/${media.id}`} className="font-medium hover:underline">
                  {media.title}
                </Link>
              </TableCell>
              <TableCell>
                <MediaTypeBadge type={media.type} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {media.release_year === null ? "—" : String(media.release_year)}
              </TableCell>
              <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                {media.genres.length > 0 ? media.genres.slice(0, 2).join(", ") : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground hidden sm:table-cell">
                <MediaDuration runtime={media.runtime_minutes} episodes={media.episode_count} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
