"use client";

import { GridIcon, ListIcon, LoaderIcon, PlusIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { FeaturedBand } from "@/components/database/featured-band";
import type { FilterSegment } from "@/components/editorial/conversational-filters";
import { ConversationalFilters } from "@/components/editorial/conversational-filters";
import { EditorialMasthead } from "@/components/editorial/editorial-masthead";
import { ImportMediaDialog } from "@/components/media/import-media-dialog";
import { MediaCard } from "@/components/media/media-card";
import { MediaPagination } from "@/components/media/media-pagination";
import { MediaTable } from "@/components/media/media-table";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaList } from "@/hooks/use-media";
import { useMediaRefresh } from "@/hooks/use-media-refresh";
import { useDashboardStats } from "@/hooks/use-stats";

type ViewMode = "grid" | "list";

/** The Database page's filter state (formerly exported from media-filters.tsx). */
interface MediaFilterValues {
  search: string;
  type: string;
  sortBy: string;
  sortOrder: string;
}

/** Type filter words. "everything" maps to the empty type (no filter). */
const TYPE_OPTIONS = [
  { value: "", word: "everything", ariaLabel: "Show everything" },
  { value: "movie", word: "movies", ariaLabel: "Show movies only" },
  { value: "tv", word: "tv", ariaLabel: "Show TV shows only" },
  { value: "anime", word: "anime", ariaLabel: "Show anime only" },
] as const;

/**
 * Sort field words, in cycle order. Each carries the sort order that reads
 * naturally for it (newest dates and highest ratings first, titles A to Z),
 * which the direction toggle can then flip.
 */
const SORT_OPTIONS = [
  { value: "date_watched", word: "recently watched", ariaLabel: "recently watched", order: "desc" },
  { value: "created_at", word: "recently added", ariaLabel: "recently added", order: "desc" },
  { value: "rating", word: "rating", ariaLabel: "group rating", order: "desc" },
  { value: "title", word: "title", ariaLabel: "title", order: "asc" },
  { value: "release_year", word: "release year", ariaLabel: "release year", order: "desc" },
] as const;

// Preserves the original page default exactly (date added, newest first); the
// conversational sentence is presentation only and must not change state.
const DEFAULT_FILTERS: MediaFilterValues = {
  search: "",
  type: "",
  sortBy: "created_at",
  sortOrder: "desc",
};

/** Roman-numeral year + month label for the issue line, e.g. "June · MMXXVI". */
function issueDateLabel(): string {
  const now = new Date();
  const month = now.toLocaleDateString("en-US", { month: "long" });
  const roman = romanNumeral(now.getFullYear());
  return `${month} · ${roman}`;
}

function romanNumeral(value: number): string {
  const table: readonly [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = value;
  let result = "";
  for (const [amount, symbol] of table) {
    while (remaining >= amount) {
      result += symbol;
      remaining -= amount;
    }
  }
  return result;
}

function MediaGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border">
          <Skeleton className="aspect-[2/3] w-full" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MediaListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-md" />
      ))}
    </div>
  );
}

export default function DatabasePage() {
  const { user } = useAuth();
  const { progress, startRefresh, cancelRefresh } = useMediaRefresh();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<MediaFilterValues>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { data: dashboardStats } = useDashboardStats();

  const { data, isLoading, mutate } = useMediaList({
    search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
    type: filters.type.length > 0 ? filters.type : undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    page,
    limit: 20,
  });

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== undefined) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleFilterChange = useCallback((newFilters: MediaFilterValues) => {
    setFilters(newFilters);
    setPage(1);

    // Debounce search, apply other filters immediately
    if (debounceRef.current !== undefined) {
      clearTimeout(debounceRef.current);
    }

    if (newFilters.search.length === 0) {
      setDebouncedSearch("");
    } else {
      debounceRef.current = setTimeout(() => {
        setDebouncedSearch(newFilters.search);
      }, 400);
    }
  }, []);

  const handleImportSuccess = useCallback(() => {
    void mutate();
  }, [mutate]);

  const isModeratorOrAdmin = user?.role === "admin" || user?.role === "moderator";

  const handleRefresh = useCallback(async () => {
    const result = await startRefresh();
    void mutate();
    if (result.failed === 0) {
      toast.success(`Refreshed ${String(result.completed)} entries`);
    } else {
      toast.warning(
        `Refreshed ${String(result.completed)}, failed ${String(result.failed)} entries`,
      );
    }
  }, [startRefresh, mutate]);

  // Conversational filter sentence. Each segment delegates to handleFilterChange
  // so the underlying state path (debounce, page reset) stays identical to the
  // previous <MediaFilters> presentation.
  const filterSegments: FilterSegment[] = useMemo(
    () => [
      {
        key: "type",
        options: TYPE_OPTIONS.map((o) => ({
          value: o.value,
          word: o.word,
          ariaLabel: o.ariaLabel,
        })),
        activeValue: filters.type,
        mode: "toggle",
        onSelect: (value) => {
          handleFilterChange({ ...filters, type: value });
        },
      },
      {
        key: "sort",
        label: "sorted by",
        options: SORT_OPTIONS.map((o) => ({
          value: o.value,
          word: o.word,
          ariaLabel: o.ariaLabel,
        })),
        activeValue: filters.sortBy,
        mode: "cycle",
        onSelect: (value) => {
          const next = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];
          handleFilterChange({ ...filters, sortBy: next.value, sortOrder: next.order });
        },
      },
    ],
    [filters, handleFilterChange],
  );

  const issueNumber = dashboardStats?.totalSessions ?? null;
  const eyebrow = issueNumber === null ? "CDb" : `CDb · Issue #${String(issueNumber)}`;

  // Continuation line under the lede. Kept off the lede so it pops in additively
  // (titles from the media list, weeks from the dashboard stats) rather than
  // reflowing the lede on load and on every filter toggle. Reads as prose to
  // match the lede's serif styling, so comma-joined (not middot-separated).
  const footnoteParts: string[] = [];
  if (data !== undefined) {
    footnoteParts.push(`${String(data.total)} titles`);
  }
  if (dashboardStats?.weeksSinceFirstSession != null) {
    footnoteParts.push(`${String(dashboardStats.weeksSinceFirstSession)} weeks in`);
  }
  const footnote = footnoteParts.length > 0 ? `${footnoteParts.join(", ")}.` : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <EditorialMasthead
        eyebrow={eyebrow}
        issueLine={issueDateLabel()}
        titleLead="The"
        titleAccent="collection"
        lede="Everything the group has watched together, in one place."
        footnote={footnote}
      />

      <FeaturedBand />

      <ConversationalFilters
        lead="The full archive"
        segments={filterSegments}
        direction={{
          value: filters.sortOrder === "asc" ? "asc" : "desc",
          onToggle: () => {
            handleFilterChange({
              ...filters,
              sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
            });
          },
          ariaLabel:
            filters.sortOrder === "asc"
              ? "Sorted ascending. Activate to sort descending."
              : "Sorted descending. Activate to sort ascending.",
        }}
        search={{
          value: filters.search,
          onChange: (value) => {
            handleFilterChange({ ...filters, search: value });
          },
        }}
        actions={
          <>
            <div className="flex items-center rounded-md border">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="size-11 rounded-r-none"
                onClick={() => {
                  setViewMode("grid");
                }}
              >
                <GridIcon className="size-4" />
                <span className="sr-only">Grid view</span>
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="size-11 rounded-l-none"
                onClick={() => {
                  setViewMode("list");
                }}
              >
                <ListIcon className="size-4" />
                <span className="sr-only">List view</span>
              </Button>
            </div>
            {isModeratorOrAdmin && !progress.isRunning && (
              <Button
                variant="outline"
                onClick={() => {
                  void handleRefresh();
                }}
              >
                <RefreshCwIcon className="mr-2 size-4" />
                Refresh database
              </Button>
            )}
            {isModeratorOrAdmin && progress.isRunning && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  <LoaderIcon className="mr-1 inline size-3 animate-spin" />
                  {progress.total > 0
                    ? `Refreshing ${String(progress.completed)}/${String(progress.total)}...`
                    : "Refreshing..."}
                </span>
                <Button variant="outline" size="sm" onClick={cancelRefresh}>
                  <XIcon className="mr-1 size-3" />
                  Cancel
                </Button>
              </div>
            )}
            <Button
              onClick={() => {
                setImportOpen(true);
              }}
            >
              <PlusIcon className="mr-2 size-4" />
              Add Media
            </Button>
          </>
        }
      />

      {isLoading && viewMode === "grid" && <MediaGridSkeleton />}
      {isLoading && viewMode === "list" && <MediaListSkeleton />}

      {!isLoading && data?.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground text-lg">No media found</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {filters.search.length > 0 || filters.type.length > 0
              ? "Try adjusting your filters."
              : "Import some movies, shows, or anime to get started!"}
          </p>
          {filters.search.length === 0 && filters.type.length === 0 && (
            <Button
              className="mt-4"
              onClick={() => {
                setImportOpen(true);
              }}
            >
              <PlusIcon className="mr-2 size-4" />
              Add Media
            </Button>
          )}
        </div>
      )}

      {!isLoading && data !== undefined && data.items.length > 0 && (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {data.items.map((media, index) => (
                <MediaCard key={media.id} media={media} index={index} />
              ))}
            </div>
          ) : (
            <MediaTable items={data.items} />
          )}

          <MediaPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      <ImportMediaDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
