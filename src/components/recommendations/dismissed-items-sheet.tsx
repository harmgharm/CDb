"use client";

import { RotateCcwIcon, Trash2Icon } from "lucide-react";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useDismissedRecommendations,
  useUndismissRecommendation,
} from "@/hooks/use-recommendations";
import type { MediaType } from "@/lib/db/types";

interface DismissedItemsSheetProps {
  readonly dismissedCount: number;
}

export function DismissedItemsSheet({ dismissedCount }: DismissedItemsSheetProps) {
  const { data } = useDismissedRecommendations();
  const { undismiss, isUndismissing } = useUndismissRecommendation();
  const items = data?.items ?? [];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2Icon className="mr-2 size-4" />
          Dismissed
          {dismissedCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {String(dismissedCount)}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Dismissed Recommendations</SheetTitle>
          <SheetDescription>
            Titles you marked as &quot;not interested&quot;. Restore any to see them in
            recommendations again.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3 overflow-y-auto pr-1">
          {items.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No dismissed recommendations yet.
            </p>
          )}

          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border p-2">
              <div className="size-12 shrink-0 overflow-hidden rounded-md">
                <MediaPoster
                  posterUrl={item.posterUrl}
                  title={item.title ?? "Unknown"}
                  className="size-full"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title ?? "Unknown"}</p>
                <div className="flex items-center gap-1.5">
                  {item.mediaType !== null && <MediaTypeBadge type={item.mediaType as MediaType} />}
                  <span className="text-muted-foreground text-xs">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground shrink-0"
                disabled={isUndismissing}
                onClick={() => {
                  void undismiss(item.id);
                }}
              >
                <RotateCcwIcon className="size-4" />
                <span className="sr-only">Restore</span>
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
