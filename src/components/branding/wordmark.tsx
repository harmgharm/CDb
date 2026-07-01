import Link from "next/link";

import { cn } from "@/lib/utils";

type WordmarkSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<WordmarkSize, string> = {
  sm: "text-2xl",
  md: "text-5xl",
  xl: "text-[clamp(56px,7vw,88px)]",
  lg: "text-[clamp(110px,15vw,220px)]",
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
