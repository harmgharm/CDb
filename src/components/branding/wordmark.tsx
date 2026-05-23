import Link from "next/link";

import { cn } from "@/lib/utils";

type WordmarkSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<WordmarkSize, string> = {
  sm: "text-2xl",
  md: "text-5xl",
  lg: "text-[clamp(64px,12vw,144px)]",
};

interface WordmarkProps {
  readonly size?: WordmarkSize;
  readonly asLink?: boolean;
  readonly className?: string;
}

export function Wordmark({ size = "sm", asLink = false, className }: WordmarkProps) {
  const content = (
    <span className={cn("font-display leading-none tracking-tight", SIZE_CLASSES[size], className)}>
      CD<em className="text-primary italic">b</em>
    </span>
  );

  return asLink ? <Link href="/">{content}</Link> : content;
}
