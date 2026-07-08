"use client";

import { StarIcon } from "lucide-react";
import * as motion from "motion/react-client";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";

import type { PublicStats } from "./types";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

interface TopRatedRowProps {
  readonly stats: PublicStats;
}

export function TopRatedRow({ stats }: TopRatedRowProps) {
  if (stats.topMedia.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="font-display mb-8 text-3xl leading-tight tracking-tight sm:text-4xl"
      >
        Top rated by <em className="text-cdb-marquee italic">the group</em>
      </motion.h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {stats.topMedia.map((media, index) => (
          <motion.div
            key={media.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5, ease: EASE_OUT }}
            className="group w-[140px] shrink-0 sm:w-[160px] md:w-[170px]"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl shadow-md transition-transform duration-200 group-hover:scale-[1.03]">
              <MediaPoster
                posterUrl={media.posterUrl}
                title={media.title}
                className="h-full w-full"
              />
              <div className="absolute right-0 bottom-0 left-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-2 left-2">
                <MediaTypeBadge type={media.type} />
              </div>
            </div>
            <h3 className="mt-2 truncate text-sm font-medium">{media.title}</h3>
            <div className="text-muted-foreground flex items-center gap-1 text-sm">
              <StarIcon className="size-3 fill-amber-500 text-amber-500" />
              <span className="text-foreground tabular-nums">{String(media.avgScore)}</span>
              <span className="text-xs">({String(media.ratingCount)})</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
