"use client";

import {
  BarChart3Icon,
  ClapperboardIcon,
  DicesIcon,
  type LucideIcon,
  SparklesIcon,
} from "lucide-react";
import * as motion from "motion/react-client";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

interface Feature {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  // CSS variable expression for the wash color (e.g. "var(--cdb-anime)").
  readonly accent: string;
}

const FEATURES: readonly Feature[] = [
  {
    icon: ClapperboardIcon,
    title: "Track & rate",
    description: "Log watch sessions and score them together.",
    accent: "var(--cdb-anime)",
  },
  {
    icon: SparklesIcon,
    title: "Smart picks",
    description: "Recommendations based on your group's taste.",
    accent: "var(--cdb-movie)",
  },
  {
    icon: BarChart3Icon,
    title: "Stats & insights",
    description: "Personal and group analytics on what you watch.",
    accent: "var(--cdb-marquee)",
  },
  {
    icon: DicesIcon,
    title: "Games",
    description: "Poster Reveal, Year Guess, and more.",
    accent: "var(--cdb-tv)",
  },
];

export function FeatureGrid() {
  return (
    <section className="mx-auto grid max-w-4xl gap-4 px-6 py-24 sm:grid-cols-2">
      {FEATURES.map((feature, index) => {
        const Icon = feature.icon;
        return (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5, ease: EASE_OUT }}
            className="rounded-2xl border p-6"
            style={{
              background: `linear-gradient(150deg, color-mix(in oklch, ${feature.accent} 10%, transparent), color-mix(in oklch, ${feature.accent} 3%, transparent))`,
              borderColor: `color-mix(in oklch, ${feature.accent} 25%, transparent)`,
            }}
          >
            <Icon className="size-6" style={{ color: feature.accent }} />
            <h3 className="mt-3 text-base font-semibold">{feature.title}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{feature.description}</p>
          </motion.div>
        );
      })}
    </section>
  );
}
