import { Badge } from "@/components/ui/badge";
import type { MediaType } from "@/lib/db/types";
import { MEDIA_TYPE_LABELS } from "@/lib/media/labels";

// Brand-token badges: ~16% tint of the type's brand hue as the background with
// the saturated hue as the foreground, matching the kit's
// `color-mix(in oklch, var(--cdb-tv) 16%, transparent)` treatment. Replaces the
// earlier Tailwind palette (blue/emerald/purple) so badges read in the CDb
// brand everywhere this shared component renders (detail, database grid, For You).
// Labels come from the shared MEDIA_TYPE_LABELS map; only the className lives here.
const MEDIA_TYPE_CLASSNAMES: Record<MediaType, string> = {
  movie:
    "border-transparent bg-[color-mix(in_oklch,var(--cdb-movie)_16%,transparent)] text-[var(--cdb-movie-text)] hover:bg-[color-mix(in_oklch,var(--cdb-movie)_24%,transparent)]",
  tv: "border-transparent bg-[color-mix(in_oklch,var(--cdb-tv)_16%,transparent)] text-[var(--cdb-tv-text)] hover:bg-[color-mix(in_oklch,var(--cdb-tv)_24%,transparent)]",
  anime:
    "border-transparent bg-[color-mix(in_oklch,var(--cdb-anime)_16%,transparent)] text-[var(--cdb-anime-text)] hover:bg-[color-mix(in_oklch,var(--cdb-anime)_24%,transparent)]",
};

interface MediaTypeBadgeProps {
  readonly type: MediaType;
}

export function MediaTypeBadge({ type }: MediaTypeBadgeProps) {
  return (
    <Badge variant="secondary" className={MEDIA_TYPE_CLASSNAMES[type]}>
      {MEDIA_TYPE_LABELS[type]}
    </Badge>
  );
}
