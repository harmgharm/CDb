"use client";

import { FilmIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";

interface MediaPosterProps {
  readonly posterUrl: string | null;
  readonly title: string;
  readonly className?: string;
  /**
   * Eagerly load and preload this image. Set true only for an above-the-fold
   * poster that is the page's LCP element (e.g. the first grid card or the
   * featured band poster); leave false for everything else so the rest of the
   * grid stays lazy.
   */
  readonly priority?: boolean;
}

export function MediaPoster({ posterUrl, title, className, priority = false }: MediaPosterProps) {
  if (posterUrl === null) {
    return (
      <div className={cn("bg-muted flex items-center justify-center rounded-md", className)}>
        <FilmIcon className="text-muted-foreground size-8" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-md", className)}>
      <Image
        src={posterUrl}
        alt={`${title} poster`}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}
