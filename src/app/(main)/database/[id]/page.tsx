"use client";

import {
  ArrowLeftIcon,
  BookmarkIcon,
  ClockIcon,
  ExternalLinkIcon,
  LoaderIcon,
  PlayCircleIcon,
  RefreshCwIcon,
  StarIcon,
  Trash2Icon,
  TvIcon,
  UserIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/media/confirm-delete-dialog";
import { CreateSessionDialog } from "@/components/media/create-session-dialog";
import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { SessionCard } from "@/components/media/session-card";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddToWatchlistButton } from "@/components/watchlist";
import { useMediaDetail } from "@/hooks/use-media";
import { useSingleMediaRefresh } from "@/hooks/use-media-refresh";
import { useDeleteMedia } from "@/hooks/use-sessions";
import { useWatchlist, useWatchlistGroupCounts } from "@/hooks/use-watchlist";

function formatMoney(value: string): string {
  const amount = Number(value);
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${String(amount)}`;
}

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(remainder)}m`;
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Skeleton className="h-8 w-20" />
      <div className="flex gap-6">
        <Skeleton className="h-72 w-48 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export default function MediaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const {
    data: media,
    error: fetchError,
    isLoading,
    mutate,
  } = useMediaDetail(params.id) as {
    data: ReturnType<typeof useMediaDetail>["data"];
    error: Error | undefined;
    isLoading: boolean;
    mutate: ReturnType<typeof useMediaDetail>["mutate"];
  };
  const { deleteMedia, isDeleting: isDeletingMedia } = useDeleteMedia();
  const { refreshMedia, isRefreshing } = useSingleMediaRefresh();
  const { data: myWatchlist, mutate: mutateWatchlist } = useWatchlist(
    user === null || media === undefined ? {} : { userId: user.id, mediaId: media.id, limit: 1 },
  );
  const { data: groupCounts } = useWatchlistGroupCounts(media === undefined ? [] : [media.id]);
  const [showDeleteMedia, setShowDeleteMedia] = useState(false);

  const isModeratorOrAdmin = user?.role === "admin" || user?.role === "moderator";

  function handleDataChange() {
    void mutate();
  }

  async function handleRefreshMedia() {
    if (media === undefined) return;
    const success = await refreshMedia(media.id);
    if (success) {
      toast.success("Media refreshed");
      void mutate();
    } else {
      toast.error("Failed to refresh media");
    }
  }

  async function handleDeleteMedia() {
    if (media === undefined) return;
    const success = await deleteMedia(media.id);
    if (success) {
      toast.success(`Deleted "${media.title}"`);
      router.push("/database");
    } else {
      toast.error("Failed to delete media");
    }
  }

  if (isLoading || (media === undefined && fetchError === undefined)) {
    return <DetailSkeleton />;
  }

  if (media === undefined) {
    return (
      <div className="mx-auto max-w-5xl py-16 text-center">
        <p className="text-muted-foreground text-lg">Media not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/database">Back to database</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back button + Admin actions */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/database">
            <ArrowLeftIcon className="mr-1 size-4" />
            Back
          </Link>
        </Button>
        {isModeratorOrAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isRefreshing}
              onClick={() => {
                void handleRefreshMedia();
              }}
            >
              {isRefreshing ? (
                <LoaderIcon className="mr-1.5 size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="mr-1.5 size-4" />
              )}
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                setShowDeleteMedia(true);
              }}
            >
              <Trash2Icon className="mr-1.5 size-4" />
              Delete Media
            </Button>
          </div>
        )}
      </div>

      {/* Hero section with backdrop */}
      {media.backdrop_url !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative -mx-6 -mt-2 h-48 overflow-hidden rounded-lg sm:h-64 md:h-80"
        >
          <Image
            src={media.backdrop_url}
            alt={`${media.title} backdrop`}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="from-background via-background/60 absolute inset-0 bg-gradient-to-t to-transparent" />
        </motion.div>
      )}

      {/* Media info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" as const }}
        className={media.backdrop_url === null ? "" : "relative z-10 -mt-24"}
      >
        <div className="flex flex-col gap-6 sm:flex-row">
          <MediaPoster
            posterUrl={media.poster_url}
            title={media.title}
            className="h-64 w-44 shrink-0 shadow-lg sm:h-72 sm:w-48"
          />

          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{media.title}</h1>
              {media.original_title !== null && (
                <p className="text-muted-foreground text-sm">{media.original_title}</p>
              )}
            </div>

            {media.tagline !== null && (
              <p className="text-muted-foreground italic">{media.tagline}</p>
            )}

            {media.directors !== null && media.directors.length > 0 && (
              <p className="text-muted-foreground text-sm">
                {media.type === "tv" ? "Created by" : "Directed by"}{" "}
                <span className="text-foreground font-medium">{media.directors.join(", ")}</span>
              </p>
            )}

            {media.top_cast !== null && media.top_cast.length > 0 && (
              <TooltipProvider>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {media.top_cast.map((member) => (
                    <Tooltip key={member.id}>
                      <TooltipTrigger asChild>
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          {member.profilePath === null ? (
                            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                              <UserIcon className="text-muted-foreground size-5" />
                            </div>
                          ) : (
                            <Image
                              src={`https://image.tmdb.org/t/p/w185${member.profilePath}`}
                              alt={member.name}
                              width={48}
                              height={48}
                              className="size-12 rounded-full object-cover"
                            />
                          )}
                          <span className="max-w-16 truncate text-center text-[11px]">
                            {member.name}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{member.character}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <MediaTypeBadge type={media.type} />
              {media.status !== null && <Badge variant="outline">{media.status}</Badge>}
              {media.certification !== null && (
                <Badge variant="outline">{media.certification}</Badge>
              )}
              {media.release_year !== null && (
                <Badge variant="outline">{String(media.release_year)}</Badge>
              )}
              {media.runtime_minutes !== null && (
                <Badge variant="outline">
                  <ClockIcon className="mr-1 size-3" />
                  {formatRuntime(media.runtime_minutes)}
                </Badge>
              )}
              {media.season_count !== null && media.episode_count !== null && (
                <Badge variant="outline">
                  <TvIcon className="mr-1 size-3" />
                  {String(media.season_count)} seasons · {String(media.episode_count)} episodes
                </Badge>
              )}
              {media.season_count === null && media.episode_count !== null && (
                <Badge variant="outline">
                  <TvIcon className="mr-1 size-3" />
                  {String(media.episode_count)} episodes
                </Badge>
              )}
              {media.stats.avgRating !== null && (
                <Badge variant="secondary" className="gap-1">
                  <StarIcon className="size-3 fill-amber-500 text-amber-500" />
                  {String(media.stats.avgRating)}/10
                  <span className="text-muted-foreground ml-0.5">
                    ({String(media.stats.ratingCount)})
                  </span>
                </Badge>
              )}
              {media.tmdb_rating !== null && (
                <Badge variant="outline" className="gap-1">
                  TMDB {String(media.tmdb_rating)}/10
                  {media.vote_count !== null && (
                    <span className="text-muted-foreground">
                      ({media.vote_count.toLocaleString()})
                    </span>
                  )}
                </Badge>
              )}
              {media.mal_score !== null && (
                <Badge variant="outline" className="gap-1">
                  MAL {String(media.mal_score)}/10
                  {media.vote_count !== null && media.tmdb_rating === null && (
                    <span className="text-muted-foreground">
                      ({media.vote_count.toLocaleString()})
                    </span>
                  )}
                </Badge>
              )}
              {media.imdb_id !== null && (
                <Badge variant="outline" asChild>
                  <a
                    href={`https://www.imdb.com/title/${media.imdb_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-1"
                  >
                    IMDb
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </Badge>
              )}
              {media.trailer_key !== null && (
                <Badge variant="outline" asChild>
                  <a
                    href={`https://www.youtube.com/watch?v=${media.trailer_key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-1"
                  >
                    <PlayCircleIcon className="size-3" />
                    Trailer
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </Badge>
              )}
              {groupCounts !== undefined && (groupCounts[media.id] ?? 0) > 0 && (
                <Badge variant="outline" className="gap-1">
                  <BookmarkIcon className="size-3" />
                  {String(groupCounts[media.id])}{" "}
                  {groupCounts[media.id] === 1 ? "person wants" : "people want"} to watch
                </Badge>
              )}
            </div>

            {media.origin_country !== null && media.origin_country.length > 0 && (
              <p className="text-muted-foreground text-sm">
                Origin: {media.origin_country.join(", ")}
              </p>
            )}

            {media.studios !== null && media.studios.length > 0 && (
              <p className="text-muted-foreground text-sm">
                Studio:{" "}
                <span className="text-foreground font-medium">{media.studios.join(", ")}</span>
              </p>
            )}

            {media.networks !== null && media.networks.length > 0 && (
              <p className="text-muted-foreground text-sm">
                On <span className="text-foreground font-medium">{media.networks.join(", ")}</span>
              </p>
            )}

            {(media.budget !== null || media.revenue !== null) && (
              <p className="text-muted-foreground text-sm">
                {media.budget !== null && `Budget: ${formatMoney(media.budget)}`}
                {media.budget !== null && media.revenue !== null && " · "}
                {media.revenue !== null && `Revenue: ${formatMoney(media.revenue)}`}
              </p>
            )}

            {media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {media.genres.map((genre) => (
                  <Badge key={genre} variant="outline" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {media.synopsis !== null && media.synopsis.length > 0 && (
              <p className="text-muted-foreground leading-relaxed">{media.synopsis}</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Sessions & Ratings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" as const }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Watch Sessions
            {media.sessions.length > 0 && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                ({String(media.sessions.length)})
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <AddToWatchlistButton
              mediaId={media.id}
              existingEntryId={myWatchlist?.items.find((item) => item.media_id === media.id)?.id}
              onAdded={() => {
                void mutateWatchlist();
              }}
              onRemoved={() => {
                void mutateWatchlist();
              }}
            />
            <CreateSessionDialog
              mediaId={media.id}
              mediaTitle={media.title}
              onCreated={handleDataChange}
            />
          </div>
        </div>

        {media.sessions.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">No watch sessions recorded yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {media.sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                ratings={media.ratings}
                currentUserId={user?.id ?? null}
                isModeratorOrAdmin={isModeratorOrAdmin}
                mediaTitle={media.title}
                onChanged={handleDataChange}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Delete media confirmation */}
      <ConfirmDeleteDialog
        open={showDeleteMedia}
        onOpenChange={setShowDeleteMedia}
        title="Delete Media"
        description={`Permanently delete "${media.title}"? All sessions and ratings for this media will also be deleted.`}
        isDeleting={isDeletingMedia}
        onConfirm={() => {
          void handleDeleteMedia();
        }}
      />
    </div>
  );
}
