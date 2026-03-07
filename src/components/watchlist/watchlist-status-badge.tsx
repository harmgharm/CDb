import { Badge } from "@/components/ui/badge";
import type { WatchlistStatus } from "@/lib/db/types";

const STATUS_CONFIG: Record<WatchlistStatus, { label: string; className: string }> = {
  planning: { label: "Planning", className: "" },
  watching: {
    label: "Watching",
    className: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  },
  scrapped: {
    label: "Scrapped",
    className: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
  },
};

interface WatchlistStatusBadgeProps {
  readonly status: WatchlistStatus;
}

export function WatchlistStatusBadge({ status }: WatchlistStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
