"use client";

import { BookmarkCheckIcon, BookmarkPlusIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/use-watchlist";

interface AddToWatchlistButtonProps {
  // For imported media
  readonly mediaId?: string;
  // For external (unimported) search results
  readonly tmdbId?: number;
  readonly malId?: number;
  readonly extTitle?: string;
  readonly extPosterUrl?: string | null;
  readonly extMediaType?: string;
  // Toggle state
  readonly existingEntryId?: string;
  readonly onAdded?: () => void;
  readonly onRemoved?: () => void;
  readonly size?: "sm" | "default" | "icon";
}

export function AddToWatchlistButton({
  mediaId,
  tmdbId,
  malId,
  extTitle,
  extPosterUrl,
  extMediaType,
  existingEntryId,
  onAdded,
  onRemoved,
  size = "sm",
}: AddToWatchlistButtonProps) {
  const { addToWatchlist, isAdding } = useAddToWatchlist();
  const { removeFromWatchlist, isRemoving } = useRemoveFromWatchlist();

  const isInWatchlist = existingEntryId !== undefined;
  const isLoading = isAdding || isRemoving;

  async function handleClick() {
    if (isInWatchlist) {
      const success = await removeFromWatchlist(existingEntryId);
      if (success) {
        toast.success("Removed from watchlist");
        onRemoved?.();
      } else {
        toast.error("Failed to remove from watchlist");
      }
      return;
    }

    const result = await addToWatchlist({
      mediaId,
      tmdbId,
      malId,
      extTitle,
      extPosterUrl,
      extMediaType,
    });
    if (result === null) {
      toast.error("Failed to add to watchlist");
      return;
    }
    toast.success("Added to watchlist");
    onAdded?.();
  }

  function renderIcon() {
    if (isLoading) return <Loader2Icon className="size-4 animate-spin" />;
    if (isInWatchlist) return <BookmarkCheckIcon className="size-4" />;
    return <BookmarkPlusIcon className="size-4" />;
  }

  return (
    <Button
      variant={isInWatchlist ? "secondary" : "outline"}
      size={size}
      disabled={isLoading}
      onClick={() => {
        void handleClick();
      }}
    >
      {renderIcon()}
      {size !== "icon" && (isInWatchlist ? "In Watchlist" : "Watchlist")}
    </Button>
  );
}
