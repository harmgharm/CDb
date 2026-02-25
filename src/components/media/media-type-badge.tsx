import { Badge } from "@/components/ui/badge";
import type { MediaType } from "@/lib/db/types";

const MEDIA_TYPE_CONFIG: Record<MediaType, { label: string; className: string }> = {
  movie: { label: "Movie", className: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" },
  tv: { label: "TV Show", className: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" },
  anime: {
    label: "Anime",
    className: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
  },
};

interface MediaTypeBadgeProps {
  readonly type: MediaType;
}

export function MediaTypeBadge({ type }: MediaTypeBadgeProps) {
  const config = MEDIA_TYPE_CONFIG[type];
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}
