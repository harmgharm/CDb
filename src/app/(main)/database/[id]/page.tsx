"use client";

import { ArrowLeftIcon, CalendarIcon, ClockIcon, StarIcon, TvIcon, UserIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaDetail } from "@/hooks/use-media";
import type { MediaRating, MediaSession } from "@/types/media-responses";

function getInitials(name: string | null, username: string): string {
  const display = name ?? username;
  return display
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

function SessionCard({
  session,
  ratings,
}: Readonly<{ session: MediaSession; ratings: MediaRating[] }>) {
  const sessionRatings = ratings.filter((r) => r.session_id === session.id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-muted-foreground size-4" />
            <CardTitle className="text-sm font-medium">
              {formatDate(session.date_watched)}
            </CardTitle>
          </div>
          {session.time_watched_at !== null && (
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <ClockIcon className="size-3" />
              {session.time_watched_at}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <UserIcon className="text-muted-foreground size-3.5" />
          <span className="text-muted-foreground">Picked by</span>
          <span className="font-medium">
            {session.picker_display_name ?? session.picker_username}
          </span>
        </div>

        {session.notes !== null && session.notes.length > 0 && (
          <p className="text-muted-foreground text-sm italic">&ldquo;{session.notes}&rdquo;</p>
        )}

        {sessionRatings.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              {sessionRatings.map((rating) => (
                <div key={rating.id} className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(rating.display_name, rating.username)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{rating.display_name ?? rating.username}</span>
                  <div className="flex items-center gap-0.5">
                    <StarIcon className="size-3 fill-amber-500 text-amber-500" />
                    <span className="text-sm font-medium">{String(rating.score)}</span>
                  </div>
                  {rating.review !== null && rating.review.length > 0 && (
                    <span className="text-muted-foreground truncate text-xs italic">
                      — {rating.review}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function MediaDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: media, isLoading } = useMediaDetail(params.id);

  if (isLoading) {
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
      {/* Back button */}
      <Button asChild variant="ghost" size="sm">
        <Link href="/database">
          <ArrowLeftIcon className="mr-1 size-4" />
          Back
        </Link>
      </Button>

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
          {/* Poster */}
          <MediaPoster
            posterUrl={media.poster_url}
            title={media.title}
            className="h-64 w-44 shrink-0 shadow-lg sm:h-72 sm:w-48"
          />

          {/* Details */}
          <div className="flex-1 space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">{media.title}</h1>

            <div className="flex flex-wrap items-center gap-2">
              <MediaTypeBadge type={media.type} />
              {media.release_year !== null && (
                <Badge variant="outline">{String(media.release_year)}</Badge>
              )}
              {media.runtime_minutes !== null && (
                <Badge variant="outline">
                  <ClockIcon className="mr-1 size-3" />
                  {String(media.runtime_minutes)}m
                </Badge>
              )}
              {media.episode_count !== null && (
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
            </div>

            {/* Genres */}
            {media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {media.genres.map((genre) => (
                  <Badge key={genre} variant="outline" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {/* Synopsis */}
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
        <h2 className="text-xl font-semibold">
          Watch Sessions
          {media.sessions.length > 0 && (
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              ({String(media.sessions.length)})
            </span>
          )}
        </h2>

        {media.sessions.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">No watch sessions recorded yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {media.sessions.map((session) => (
              <SessionCard key={session.id} session={session} ratings={media.ratings} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
