"use client";

import { StarIcon } from "lucide-react";
import Link from "next/link";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeatured } from "@/hooks/use-featured";
import type { FeaturedMedia } from "@/types/detailed-stats";

function runtimeLabel(media: FeaturedMedia): string | null {
  if (media.type === "movie") {
    return media.runtimeMinutes === null ? null : `${String(media.runtimeMinutes)} min`;
  }
  if (media.episodeCount === null) {
    return null;
  }
  return `${String(media.episodeCount)} ${media.episodeCount === 1 ? "episode" : "episodes"}`;
}

function MetaSeparator() {
  return <span className="text-[var(--fg-dim)]">·</span>;
}

function FeaturedMainCard({ media, eyebrow }: Readonly<{ media: FeaturedMedia; eyebrow: string }>) {
  const runtime = runtimeLabel(media);

  return (
    <Link
      href={`/database/${media.id}`}
      className="bg-card hover:border-cdb-marquee/45 grid grid-cols-[160px_1fr] gap-6 overflow-hidden rounded-xl border p-5 transition-colors sm:grid-cols-[200px_1fr]"
    >
      <MediaPoster
        posterUrl={media.posterUrl}
        title={media.title}
        className="aspect-[2/3] w-full shadow-lg"
      />
      <div className="flex flex-col gap-2.5 py-1">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
          {eyebrow}
        </p>
        <h2 className="font-display text-[44px] leading-none font-normal tracking-[-0.02em]">
          {media.title}
        </h2>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[13px]">
          <MediaTypeBadge type={media.type} />
          {media.releaseYear !== null && (
            <>
              <MetaSeparator />
              <span>{media.releaseYear}</span>
            </>
          )}
          {runtime !== null && (
            <>
              <MetaSeparator />
              <span>{runtime}</span>
            </>
          )}
        </div>
        <div className="mt-auto flex items-center gap-3.5 border-t pt-4">
          <span className="font-display text-cdb-marquee text-[56px] leading-none tracking-[-0.03em] tabular-nums">
            {media.avgScore.toFixed(1)}
          </span>
          <div>
            <div className="text-muted-foreground text-[13px]">/ 10 group avg</div>
            <div className="font-mono text-[11px] text-[var(--fg-dim)]">
              {media.ratingCount} {media.ratingCount === 1 ? "rating" : "ratings"}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FeaturedSideCard({ media, rank }: Readonly<{ media: FeaturedMedia; rank: number }>) {
  return (
    <Link
      href={`/database/${media.id}`}
      className="bg-card hover:border-cdb-marquee/45 flex min-h-20 flex-1 gap-3 rounded-lg border p-2.5 transition-colors"
    >
      <MediaPoster
        posterUrl={media.posterUrl}
        title={media.title}
        className="aspect-[2/3] w-14 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <div className="font-mono text-[10px] tracking-[0.1em] text-[var(--fg-dim)]">
          {String(rank).padStart(2, "0")}
        </div>
        <div className="font-display truncate text-[18px] leading-none tracking-[-0.015em]">
          {media.title}
        </div>
        <div className="text-muted-foreground mt-auto flex items-center gap-1.5 text-[11px]">
          <StarIcon className="size-2.5 fill-amber-500 text-amber-500" />
          <span className="tabular-nums">{media.avgScore.toFixed(1)}</span>
          <MetaSeparator />
          <MediaTypeBadge type={media.type} />
        </div>
      </div>
    </Link>
  );
}

function FeaturedSkeleton() {
  return (
    <section className="grid gap-[18px] lg:grid-cols-[2fr_1fr]">
      <Skeleton className="h-[280px] rounded-xl" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-20 flex-1 rounded-lg" />
        ))}
      </div>
    </section>
  );
}

export function FeaturedBand() {
  const { data, isLoading } = useFeatured();

  if (isLoading) {
    return <FeaturedSkeleton />;
  }

  const main = data?.main;
  if (data === undefined || main === null || main === undefined) {
    return null;
  }

  const eyebrow =
    data.scope === "month" ? "Featured · highest rated this month" : "Featured · highest rated";

  return (
    <section className="grid gap-[18px] lg:grid-cols-[2fr_1fr]">
      <FeaturedMainCard media={main} eyebrow={eyebrow} />
      {data.supporting.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.supporting.map((media, index) => (
            <FeaturedSideCard key={media.id} media={media} rank={index + 2} />
          ))}
        </div>
      )}
    </section>
  );
}
