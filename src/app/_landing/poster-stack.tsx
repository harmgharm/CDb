"use client";

import * as motion from "motion/react-client";
import Image from "next/image";

import { cn } from "@/lib/utils";

// Match the kit's p1..p6 placements exactly. Each slot is a percentage-positioned,
// rotated poster slot — three foreground (sharper, larger) interleaved with three
// blurred background pieces, like a stack of posters on a table.
const SLOTS = [
  { layer: "bg", position: "left-[3%] top-[12%]", rotate: -7, fallback: "p1" },
  { layer: "fg", position: "left-[22%] top-[40%]", rotate: 4, fallback: "p2" },
  { layer: "fg", position: "right-[22%] top-[14%]", rotate: 6, fallback: "p3" },
  { layer: "bg", position: "right-[3%] top-[38%]", rotate: -5, fallback: "p4" },
  { layer: "bg", position: "left-[9%] top-[60%]", rotate: 5, fallback: "p5" },
  { layer: "fg", position: "right-[12%] top-[64%]", rotate: -3, fallback: "p6" },
] as const;

// Warm gradient fallbacks per slot — used when there's no poster image for a slot.
// Pulled from the design system's hero-treatment preview to keep slots visually distinct.
const FALLBACK_GRADIENTS: Record<string, string> = {
  p1: "linear-gradient(160deg, oklch(0.35 0.18 30) 0%, oklch(0.18 0.10 350) 100%)",
  p2: "linear-gradient(135deg, oklch(0.55 0.22 320) 0%, oklch(0.25 0.18 280) 100%)",
  p3: "linear-gradient(150deg, oklch(0.35 0.15 200) 0%, oklch(0.20 0.10 250) 100%)",
  p4: "linear-gradient(160deg, oklch(0.30 0.10 60) 0%, oklch(0.10 0.04 40) 100%)",
  p5: "linear-gradient(135deg, oklch(0.45 0.20 0) 0%, oklch(0.20 0.10 350) 100%)",
  p6: "linear-gradient(160deg, oklch(0.40 0.15 100) 0%, oklch(0.15 0.08 80) 100%)",
};

const LAYER_CLASSES = {
  fg: "w-[26%] sm:w-[22%] md:w-[21%] opacity-[0.78] blur-[0.5px] saturate-[1.05]",
  bg: "w-[20%] sm:w-[17%] md:w-[15%] opacity-[0.42] blur-[10px] saturate-[1.1]",
} as const;

interface PosterStackProps {
  readonly posters: readonly (string | null)[];
}

export function PosterStack({ posters }: PosterStackProps) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {SLOTS.map((slot, index) => {
        const posterUrl = posters[index] ?? null;
        return (
          <motion.div
            key={slot.fallback}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{
              opacity: slot.layer === "fg" ? 0.78 : 0.42,
              scale: 1,
            }}
            transition={{
              delay: index * 0.08,
              duration: 0.9,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ transform: `rotate(${String(slot.rotate)}deg)` }}
            className={cn(
              "absolute aspect-[2/3] overflow-hidden rounded-[10px]",
              "shadow-[0_30px_80px_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.04)]",
              slot.position,
              LAYER_CLASSES[slot.layer],
            )}
          >
            {posterUrl === null ? (
              <div
                className="h-full w-full"
                style={{ backgroundImage: FALLBACK_GRADIENTS[slot.fallback] }}
              />
            ) : (
              <Image
                src={posterUrl}
                alt=""
                fill
                sizes="(max-width: 640px) 26vw, (max-width: 1024px) 22vw, 21vw"
                className="object-cover"
                priority={slot.layer === "fg"}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
