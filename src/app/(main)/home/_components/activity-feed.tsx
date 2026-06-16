"use client";

import { ClapperboardIcon, StarIcon } from "lucide-react";
import * as motion from "motion/react-client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityFeed } from "@/hooks/use-stats";
import type { FeedItem } from "@/types/stats";

const MEDIA_TYPE_LABELS: Record<string, string> = {
  movie: "Movie",
  tv: "TV Show",
  anime: "Anime",
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${String(diffMinutes)}m ago`;
  if (diffHours < 24) return `${String(diffHours)}h ago`;
  if (diffDays < 7) return `${String(diffDays)}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string | null, username: string): string {
  const display = name ?? username;
  return display
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function FeedItemCard({ item, index }: Readonly<{ item: FeedItem; index: number }>) {
  if (item.type === "session") {
    const { data } = item;
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
      >
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <div className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-full">
            <ClapperboardIcon className="text-primary size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">
                {data.picker_display_name ?? data.picker_username}
              </span>{" "}
              picked <span className="font-medium">{data.media_title}</span>
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {MEDIA_TYPE_LABELS[data.media_type] ?? data.media_type}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {formatRelativeTime(data.created_at)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const { data } = item;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <div className="flex items-start gap-3 rounded-lg border p-3">
        <Avatar className="size-8">
          <AvatarImage
            src={data.avatar_url ?? undefined}
            alt={data.display_name ?? data.username}
          />
          <AvatarFallback className="text-xs">
            {getInitials(data.display_name, data.username)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-medium">{data.display_name ?? data.username}</span> rated{" "}
            <span className="font-medium">{data.media_title}</span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <StarIcon className="size-3 fill-amber-500 text-amber-500" />
              <span className="text-xs font-medium">{String(data.score)}/10</span>
            </div>
            {data.review !== null && data.review.length > 0 && (
              <span className="text-muted-foreground truncate text-xs italic">
                &ldquo;{data.review}&rdquo;
              </span>
            )}
            <span className="text-muted-foreground text-xs">
              {formatRelativeTime(data.created_at)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-lg border p-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed() {
  const { data: feed, isLoading } = useActivityFeed();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
          Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <FeedSkeleton />}
        {!isLoading && (feed === undefined || feed.items.length === 0) && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No activity yet. Start a watch session to see updates here!
          </p>
        )}
        {!isLoading && feed !== undefined && feed.items.length > 0 && (
          <div className="space-y-3">
            {feed.items.map((item, index) => (
              <FeedItemCard key={`${item.type}-${item.data.id}`} item={item} index={index} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
