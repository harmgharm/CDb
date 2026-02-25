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

function MediaDuration({
  runtime,
  episodes,
}: Readonly<{ runtime: number | null; episodes: number | null }>) {
  if (runtime !== null) {
    return <>{String(runtime)}m</>;
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16" />
            <TableHead>Title</TableHead>
            <TableHead className="w-24">Type</TableHead>
            <TableHead className="w-16">Year</TableHead>
            <TableHead className="w-24">Genres</TableHead>
            <TableHead className="w-20">Runtime</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((media) => (
            <TableRow key={media.id} className="group">
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
              <TableCell className="text-muted-foreground text-xs">
                {media.genres.length > 0 ? media.genres.slice(0, 2).join(", ") : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <MediaDuration runtime={media.runtime_minutes} episodes={media.episode_count} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
