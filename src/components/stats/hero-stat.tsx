"use client";

import * as motion from "motion/react-client";
import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";

interface HeroStatProps {
  readonly label: string;
  readonly value: number | string;
  readonly suffix?: string;
  readonly icon: React.ReactNode;
  readonly index?: number;
  /** Custom color classes for the icon container (bg + text) */
  readonly color?: string;
}

/**
 * Animated number counter. For numeric values, counts up from 0 on mount.
 * For string values (like time), just displays directly.
 */
function AnimatedValue({
  value,
  suffix,
}: {
  readonly value: number | string;
  readonly suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const isNumeric = typeof value === "number";

  useEffect(() => {
    if (!isNumeric) return;

    const target = value;
    const duration = 1000;
    const startTime = performance.now();

    function update(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(eased * target);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }, [isNumeric, value]);

  if (!isNumeric) {
    return (
      <span className="text-2xl font-bold tracking-tight">
        {value}
        {suffix !== undefined && (
          <span className="text-muted-foreground ml-1 text-sm font-normal">{suffix}</span>
        )}
      </span>
    );
  }

  // Format the number nicely
  const isDecimal = value % 1 !== 0;
  const formatted = isDecimal ? displayValue.toFixed(1) : String(Math.round(displayValue));

  return (
    <span className="text-2xl font-bold tracking-tight">
      {formatted}
      {suffix !== undefined && (
        <span className="text-muted-foreground ml-1 text-sm font-normal">{suffix}</span>
      )}
    </span>
  );
}

export function HeroStat({ label, value, suffix, icon, index = 0, color }: HeroStatProps) {
  const iconClasses = color ?? "bg-primary/10 text-primary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: "easeOut" as const }}
    >
      <Card>
        <CardContent className="flex items-center gap-3 pt-4">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClasses}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">{label}</p>
            <AnimatedValue value={value} suffix={suffix} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
