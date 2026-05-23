import { Badge } from "@/components/ui/badge";
import type { WatchlistStatus } from "@/lib/db/types";

const STATUS_CONFIG: Record<WatchlistStatus, { label: string; className: string }> = {
  planning: { label: "Planning", className: "" },
  watching: {
    label: "Watching",
    className: "bg-cdb-info/10 text-cdb-info hover:bg-cdb-info/20",
  },
  scrapped: {
    label: "Scrapped",
    className: "text-muted-foreground",
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
