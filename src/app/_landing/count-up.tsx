"use client";

import { animate, useMotionValue, useTransform } from "motion/react";
import { useEffect, useState } from "react";

interface CountUpProps {
  readonly target: number;
}

export function CountUp({ target }: CountUpProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, target, {
      duration: 1.5,
      ease: "easeOut",
    });
    const unsubscribe = rounded.on("change", (value) => {
      setDisplay(value);
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [count, rounded, target]);

  return <>{String(display)}</>;
}
