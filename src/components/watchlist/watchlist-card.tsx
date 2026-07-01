"use client";

import {
  BookmarkXIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  ListIcon,
  StarIcon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ImportMediaDialog } from "@/components/media/import-media-dialog";
import { MediaPoster } from "@/components/media/media-poster";
import { MediaPreviewDialog } from "@/components/media/media-preview-dialog";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueue } from "@/hooks/use-queue";
import {
  useAddToWatchlist,
  useProposeWatchlistItem,
  useRemoveFromWatchlist,
  useUpdateWatchlistEntry,
} from "@/hooks/use-watchlist";
import type { WatchlistStatus } from "@/lib/db/types";
import { isWatchlistEntryProposed, planWatchlistPropose } from "@/lib/watchlist/propose";
import type { MediaSearchResult } from "@/types/media";
import type { PredictionSummary } from "@/types/prediction-responses";
import type { WatchlistItem } from "@/types/watchlist-responses";

import { WatchlistStatusBadge } from "./watchlist-status-badge";

/** Convert a watchlist entry with external IDs into a MediaSearchResult for the preview dialog */
function toSearchResult(entry: WatchlistItem): MediaSearchResult | null {
  if (entry.tmdb_id !== null) {
    return {
      externalId: entry.tmdb_id,
      title: entry.title,
      type: entry.media_type,
      posterUrl: entry.poster_url,
      releaseYear: null,
      overview: null,
      source: "tmdb",
    };
  }
  if (entry.mal_id !== null) {
    return {
      externalId: entry.mal_id,
      title: entry.title,
      type: entry.media_type,
      posterUrl: entry.poster_url,
      releaseYear: null,
      overview: null,
      source: "jikan",
    };
  }
  return null;
}

const STATUS_OPTIONS: { value: WatchlistStatus; label: string; icon: typeof ListIcon }[] = [
  { value: "planning", label: "Planning", icon: ListIcon },
  { value: "watching", label: "Watching", icon: EyeIcon },
  { value: "scrapped", label: "Scrapped", icon: XCircleIcon },
];

interface WatchlistCardLinkProps {
  readonly mediaId: string | null;
  readonly searchResult: MediaSearchResult | null;
  readonly previewOpen: boolean;
  readonly onPreviewOpenChange: (open: boolean) => void;
  readonly isWatchlisted: boolean;
  readonly isAddingToWatchlist: boolean;
  readonly onAddToWatchlist: () => void;
  readonly isRemoving?: boolean;
  readonly onRemoveFromWatchlist?: () => void;
  readonly onPropose?: () => void;
  readonly isProposing?: boolean;
  readonly isProposed?: boolean;
  readonly onImport: () => void;
  readonly children: React.ReactNode;
}

function WatchlistCardLink({
  mediaId,
  searchResult,
  previewOpen,
  onPreviewOpenChange,
  isWatchlisted,
  isAddingToWatchlist,
  onAddToWatchlist,
  isRemoving = false,
  onRemoveFromWatchlist,
  onPropose,
  isProposing = false,
  isProposed = false,
  onImport,
  children,
}: WatchlistCardLinkProps) {
  if (mediaId !== null) {
    return (
      <Link href={`/database/${mediaId}`} className="block">
        {children}
      </Link>
    );
  }

  if (searchResult === null) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="cursor-pointer"
        onClick={() => {
          onPreviewOpenChange(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            onPreviewOpenChange(true);
          }
        }}
      >
        {children}
      </div>
      <MediaPreviewDialog
        open={previewOpen}
        onOpenChange={onPreviewOpenChange}
        result={searchResult}
        isImporting={false}
        onImport={onImport}
        isWatchlisted={isWatchlisted}
        isAddingToWatchlist={isAddingToWatchlist}
        onAddToWatchlist={onAddToWatchlist}
        isRemovingFromWatchlist={isRemoving}
        onRemoveFromWatchlist={onRemoveFromWatchlist}
        onPropose={onPropose}
        isProposing={isProposing}
        isProposed={isProposed}
      />
    </>
  );
}

interface WatchlistCardProps {
  readonly entry: WatchlistItem;
  readonly index: number;
  readonly isOwnProfile: boolean;
  readonly onChanged: () => void;
  readonly prediction?: PredictionSummary;
}

export function WatchlistCard({
  entry,
  index,
  isOwnProfile,
  onChanged,
  prediction,
}: WatchlistCardProps) {
  const { updateEntry } = useUpdateWatchlistEntry();
  const { removeFromWatchlist, isRemoving } = useRemoveFromWatchlist();
  const { addToWatchlist, isAdding: isAddingToWatchlist } = useAddToWatchlist();
  const { proposeEntry, isProposing } = useProposeWatchlistItem();
  const { scheduled, proposals, refresh: refreshQueue } = useQueue();
  // An entry with no media_id and no external id can't anchor a proposal — hide
  // the affordance rather than offer a guaranteed-to-fail action.
  const canPropose = planWatchlistPropose(entry).kind !== "unproposable";
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [myWatchlistEntryId, setMyWatchlistEntryId] = useState<string>();
  const [locallyRemoved, setLocallyRemoved] = useState(false);
  // Set when this session proposed the entry — covers an external-only entry
  // whose freshly-imported media_id the live queue can't key yet (see
  // isWatchlistEntryProposed).
  const [locallyProposed, setLocallyProposed] = useState(false);
  const searchResult = entry.media_id === null ? toSearchResult(entry) : null;

  // Live media ids in the group queue (scheduled pick + open proposals); a match
  // renders the disabled "Proposed" state and persists across close/reopen.
  const queuedMediaIds = useMemo(() => {
    const ids = new Set<string>();
    if (scheduled !== null) ids.add(scheduled.media.id);
    for (const proposal of proposals) ids.add(proposal.media.id);
    return ids;
  }, [scheduled, proposals]);
  const isProposed = isWatchlistEntryProposed(entry, queuedMediaIds, locallyProposed);

  // On own profile, the entry is always in the user's watchlist.
  // On other profiles, track whether the current user has added it to their own watchlist.
  const isInMyWatchlist = isOwnProfile ? true : myWatchlistEntryId !== undefined && !locallyRemoved;

  async function handleStatusChange(newStatus: WatchlistStatus) {
    const success = await updateEntry(entry.id, { status: newStatus });
    if (success) {
      toast.success(`Status changed to ${newStatus}`);
      onChanged();
    } else {
      toast.error("Failed to update status");
    }
  }

  async function handleRemove() {
    const success = await removeFromWatchlist(entry.id);
    if (success) {
      toast.success("Removed from watchlist");
      onChanged();
    } else {
      toast.error("Failed to remove");
    }
  }

  // Shared by the dialog Propose button and the dropdown "Propose to group" item.
  async function handlePropose() {
    const proposed = await proposeEntry(entry);
    if (!proposed) return;
    setLocallyProposed(true);
    // Refresh the queue so `queuedMediaIds` includes the new proposal — once an
    // import-then-propose backfill gives the watchlist refetch a real media_id,
    // the live cross-ref already matches, so isProposed stays true with no
    // flicker (the local flag is only a bridge for external-only entries).
    void refreshQueue();
    // Revalidate the list so the backfilled media_id lands without a reload,
    // consistent with the import dialog's post-propose refresh.
    onChanged();
  }

  const cardContent = (
    <div className="flex gap-3">
      <MediaPoster
        posterUrl={entry.poster_url}
        title={entry.title}
        className="h-24 w-16 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h4 className="truncate text-sm font-medium">{entry.title}</h4>
        <div className="mt-1 flex items-center gap-1.5">
          <MediaTypeBadge type={entry.media_type} />
          <WatchlistStatusBadge status={entry.status} />
        </div>
        {entry.notes !== null && entry.notes.length > 0 && (
          <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs">{entry.notes}</p>
        )}
        {/* Prediction as the kit's cdb-wl-pred footer text (star + score +
            "predicted" caption), bottom-right. Hover keeps the verdict/confidence. */}
        {prediction !== undefined && (
          <div className="mt-auto flex justify-end pt-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums">
                  <StarIcon className="size-3 fill-amber-500 text-amber-500" />
                  {String(prediction.predictedScore)}
                  <span className="ml-0.5 text-[10px] font-normal text-[var(--fg-dim)]">
                    predicted
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Predicted rating: {String(prediction.predictedScore)}/10 — {prediction.verdict} (
                {prediction.confidence} confidence)
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
      className="group relative rounded-lg border p-3"
    >
      <WatchlistCardLink
        mediaId={entry.media_id}
        searchResult={searchResult}
        previewOpen={previewOpen}
        onPreviewOpenChange={setPreviewOpen}
        isWatchlisted={isInMyWatchlist}
        isAddingToWatchlist={isAddingToWatchlist}
        onAddToWatchlist={() => {
          void (async () => {
            const added = await addToWatchlist({
              mediaId: entry.media_id ?? undefined,
              tmdbId: entry.tmdb_id ?? undefined,
              malId: entry.mal_id ?? undefined,
              extTitle: entry.title,
              extPosterUrl: entry.poster_url,
              extMediaType: entry.media_type,
            });
            if (added === null) {
              toast.error("Failed to add to watchlist");
            } else {
              setMyWatchlistEntryId(added.id);
              setLocallyRemoved(false);
              toast.success("Added to watchlist");
            }
          })();
        }}
        isRemoving={isRemoving}
        onRemoveFromWatchlist={() => {
          const entryIdToRemove = isOwnProfile ? entry.id : myWatchlistEntryId;
          if (entryIdToRemove === undefined) return;
          void (async () => {
            const success = await removeFromWatchlist(entryIdToRemove);
            if (success) {
              if (isOwnProfile) {
                setPreviewOpen(false);
                onChanged();
              } else {
                setMyWatchlistEntryId(undefined);
                setLocallyRemoved(true);
              }
              toast.success("Removed from watchlist");
            } else {
              toast.error("Failed to remove from watchlist");
            }
          })();
        }}
        onPropose={
          canPropose
            ? () => {
                void handlePropose();
              }
            : undefined
        }
        isProposing={isProposing}
        isProposed={isProposed}
        onImport={() => {
          setPreviewOpen(false);
          setImportOpen(true);
        }}
      >
        {cardContent}
      </WatchlistCardLink>

      {/* Full import dialog — only mounted when open (it calls the whole app's
          hook tree at render). Lets a user import without proposing, and the
          dialog's own Propose button carries the working "Proposed" state. */}
      {importOpen && searchResult !== null && (
        <ImportMediaDialog
          key={entry.title}
          open={importOpen}
          onOpenChange={setImportOpen}
          onSuccess={onChanged}
          initialQuery={entry.title}
        />
      )}

      {isOwnProfile && (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
              >
                <EllipsisVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Change Status</DropdownMenuLabel>
              {STATUS_OPTIONS.filter((opt) => opt.value !== entry.status).map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => {
                    void handleStatusChange(opt.value);
                  }}
                >
                  <opt.icon className="mr-2 size-4" />
                  {opt.label}
                </DropdownMenuItem>
              ))}
              {/* Hidden while the title is in the active queue (isProposed) — it
                  reappears once the pick is watched and drops out of the queue,
                  matching this menu's filter-out idiom for unavailable actions. */}
              {canPropose && !isProposed && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={isProposing}
                    onClick={() => {
                      void handlePropose();
                    }}
                  >
                    <UsersIcon className="mr-2 size-4" />
                    Propose to group
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  void handleRemove();
                }}
              >
                <BookmarkXIcon className="mr-2 size-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </motion.div>
  );
}
