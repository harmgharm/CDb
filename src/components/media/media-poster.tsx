"use client";

import { FilmIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";

interface MediaPosterProps {
  readonly posterUrl: string | null;
  readonly title: string;
  readonly className?: string;
}

export function MediaPoster({ posterUrl, title, className }: MediaPosterProps) {
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
      />
    </div>
  );
}
