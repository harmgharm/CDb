"use client";

import {
  CalendarIcon,
  GridIcon,
  ListIcon,
  LoaderIcon,
  PlusIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { DatabaseTimeline, TimelineSkeleton } from "@/components/database/database-timeline";
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
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { useMediaList } from "@/hooks/use-media";
import { useMediaRefresh } from "@/hooks/use-media-refresh";
import { useSessionsTimeline } from "@/hooks/use-sessions";
import { useDashboardStats } from "@/hooks/use-stats";
import { type DatabaseView, useStoredView } from "@/hooks/use-stored-view";
import type { MediaListResponse } from "@/types/media-responses";

type ViewMode = DatabaseView;

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

// Option lists for <ConversationalFilters>, precomputed once (the segments
// themselves are rebuilt per render because their onSelect closes over state).
const TYPE_FILTER_OPTIONS = TYPE_OPTIONS.map((o) => ({
  value: o.value,
  word: o.word,
  ariaLabel: o.ariaLabel,
}));
const SORT_FILTER_OPTIONS = SORT_OPTIONS.map((o) => ({
  value: o.value,
  word: o.word,
  ariaLabel: o.ariaLabel,
}));

/**
 * Items per archive page. Shared by the media-list request and the grid card's
 * page-absolute rank so the "#NN" numbering can't drift from the actual limit.
 */
const MEDIA_PAGE_SIZE = 20;

// Preserves the original page default exactly (date added, newest first); the
// conversational sentence is presentation only and must not change state.
const DEFAULT_FILTERS: MediaFilterValues = {
  search: "",
  type: "",
  sortBy: "created_at",
  sortOrder: "desc",
};

/**
 * Build the conversational filter sentence segments. Each `onSelect` delegates
 * to `onChange` (the page's debounced handler). In timeline view the sort
 * segment is dropped (the diary is always chronological); type stays in both.
 */
function buildFilterSegments(
  filters: MediaFilterValues,
  isTimeline: boolean,
  onChange: (next: MediaFilterValues) => void,
): FilterSegment[] {
  const typeSegment: FilterSegment = {
    key: "type",
    options: TYPE_FILTER_OPTIONS,
    activeValue: filters.type,
    mode: "toggle",
    onSelect: (value) => {
      onChange({ ...filters, type: value });
    },
  };
  if (isTimeline) {
    return [typeSegment];
  }
  const sortSegment: FilterSegment = {
    key: "sort",
    label: "sorted by",
    options: SORT_FILTER_OPTIONS,
    activeValue: filters.sortBy,
    mode: "cycle",
    onSelect: (value) => {
      const next = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];
      onChange({ ...filters, sortBy: next.value, sortOrder: next.order });
    },
  };
  return [typeSegment, sortSegment];
}

/**
 * The asc/desc arrow for the conversational filter sentence. In grid/list it
 * flips the active sort field's direction; in timeline it flips the diary's
 * chronological order (asc = oldest-first, desc = newest-first). Both views map
 * to the same `filters.sortOrder`, so the arrow stays consistent when switching.
 */
function buildSortDirection(
  filters: MediaFilterValues,
  onChange: (next: MediaFilterValues) => void,
  isTimeline: boolean,
) {
  const ascending = filters.sortOrder === "asc";
  const timelineAria = ascending
    ? "Oldest first. Activate to show newest first."
    : "Newest first. Activate to show oldest first.";
  const sortAria = ascending
    ? "Sorted ascending. Activate to sort descending."
    : "Sorted descending. Activate to sort ascending.";
  return {
    value: ascending ? ("asc" as const) : ("desc" as const),
    onToggle: () => {
      onChange({ ...filters, sortOrder: ascending ? "desc" : "asc" });
    },
    ariaLabel: isTimeline ? timelineAria : sortAria,
  };
}

/**
 * Continuation line under the lede ("48 titles, 12 weeks in."). Kept off the
 * lede so it pops in additively (titles from the media list, weeks from the
 * dashboard stats) rather than reflowing the lede on load. Reads as prose, so
 * comma-joined (not middot-separated).
 */
function buildFootnote(total: number | undefined, weeks: number | null): string | undefined {
  const parts: string[] = [];
  if (total !== undefined) {
    parts.push(`${String(total)} titles`);
  }
  if (weeks !== null) {
    parts.push(`${String(weeks)} weeks in`);
  }
  return parts.length > 0 ? `${parts.join(", ")}.` : undefined;
}

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
        <div key={index} className="bg-card overflow-hidden rounded-lg border">
          <Skeleton className="aspect-[2/3] w-full rounded-none" />
          <div className="space-y-2 px-3 pt-2.5 pb-3">
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

interface FiltersActive {
  readonly hasSearch: boolean;
  readonly hasType: boolean;
}

interface MediaArchiveProps {
  readonly view: "grid" | "list";
  readonly data: MediaListResponse | undefined;
  readonly isLoading: boolean;
  readonly page: number;
  readonly onPageChange: (page: number) => void;
  readonly filtersActive: FiltersActive;
  readonly onAddMedia: () => void;
}

/** Grid / list archive body (the media catalog views). */
function MediaArchive({
  view,
  data,
  isLoading,
  page,
  onPageChange,
  filtersActive,
  onAddMedia,
}: MediaArchiveProps) {
  if (isLoading) {
    return view === "grid" ? <MediaGridSkeleton /> : <MediaListSkeleton />;
  }

  if (data === undefined || data.items.length === 0) {
    const filtered = filtersActive.hasSearch || filtersActive.hasType;
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground text-lg">No media found</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {filtered
            ? "Try adjusting your filters."
            : "Import some movies, shows, or anime to get started!"}
        </p>
        {!filtered && (
          <Button className="mt-4" onClick={onAddMedia}>
            <PlusIcon className="mr-2 size-4" />
            Add Media
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.items.map((media, index) => (
            <MediaCard
              key={media.id}
              media={media}
              index={index}
              rank={(page - 1) * MEDIA_PAGE_SIZE + index + 1}
            />
          ))}
        </div>
      ) : (
        <MediaTable items={data.items} />
      )}
      <MediaPagination page={page} totalPages={data.totalPages} onPageChange={onPageChange} />
    </>
  );
}

interface ViewToggleProps {
  readonly view: ViewMode;
  readonly onChange: (view: ViewMode) => void;
}

/** Grid / list / timeline segmented toggle. */
function ViewToggle({ view, onChange }: ViewToggleProps) {
  const buttons = [
    { mode: "grid" as const, Icon: GridIcon, label: "Grid view", rounding: "rounded-r-none" },
    { mode: "list" as const, Icon: ListIcon, label: "List view", rounding: "rounded-none" },
    {
      mode: "timeline" as const,
      Icon: CalendarIcon,
      label: "Timeline view",
      rounding: "rounded-l-none",
    },
  ];
  return (
    <div className="flex items-center rounded-md border">
      {buttons.map(({ mode, Icon, label, rounding }) => (
        <Button
          key={mode}
          variant={view === mode ? "secondary" : "ghost"}
          size="icon"
          className={`size-11 ${rounding}`}
          onClick={() => {
            onChange(mode);
          }}
        >
          <Icon className="size-4" />
          <span className="sr-only">{label}</span>
        </Button>
      ))}
    </div>
  );
}

interface RefreshControlsProps {
  readonly progress: ReturnType<typeof useMediaRefresh>["progress"];
  readonly onRefresh: () => void;
  readonly onCancel: () => void;
}

/** Moderator/admin database-refresh button and in-progress indicator. */
function RefreshControls({ progress, onRefresh, onCancel }: RefreshControlsProps) {
  if (!progress.isRunning) {
    return (
      <Button variant="outline" onClick={onRefresh}>
        <RefreshCwIcon className="mr-2 size-4" />
        Refresh database
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">
        <LoaderIcon className="mr-1 inline size-3 animate-spin" />
        {progress.total > 0
          ? `Refreshing ${String(progress.completed)}/${String(progress.total)}...`
          : "Refreshing..."}
      </span>
      <Button variant="outline" size="sm" onClick={onCancel}>
        <XIcon className="mr-1 size-3" />
        Cancel
      </Button>
    </div>
  );
}

/**
 * The kit's "— end of issue —" sign-off: a top-ruled, centered eyebrow that
 * ties off the editorial frame. Rendered only when the archive has content (no
 * issue to end on an empty or still-loading page).
 */
function IssueFooter() {
  return (
    <div className="flex justify-center border-t pt-6">
      <span className="text-[11px] font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
        – end of issue –
      </span>
    </div>
  );
}

interface TimelineArchiveProps {
  readonly timeline: ReturnType<typeof useSessionsTimeline>;
  readonly filtersActive: FiltersActive;
}

/** Timeline archive body (the watch-session diary). */
function TimelineArchive({ timeline, filtersActive }: TimelineArchiveProps) {
  if (timeline.isLoading) {
    return <TimelineSkeleton />;
  }

  if (timeline.isEmpty) {
    const filtered = filtersActive.hasSearch || filtersActive.hasType;
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground text-lg">No sessions yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {filtered ? "Try adjusting your filters." : "Log a movie night to start the timeline."}
        </p>
      </div>
    );
  }

  return (
    <DatabaseTimeline
      items={timeline.items}
      groupSize={timeline.groupSize}
      hasMore={timeline.hasMore}
      isLoadingMore={timeline.isLoadingMore}
      onLoadMore={timeline.loadMore}
    />
  );
}

export default function DatabasePage() {
  const { user } = useAuth();
  const { progress, startRefresh, cancelRefresh } = useMediaRefresh();
  // View is a personal preference, persisted across visits (last-used wins).
  const [viewMode, setViewMode] = useStoredView();
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<MediaFilterValues>(DEFAULT_FILTERS);
  const { debounced: debouncedSearch, schedule: scheduleSearch } = useDebouncedSearch();
  const { data: dashboardStats } = useDashboardStats();

  const { data, isLoading, mutate } = useMediaList({
    search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
    type: filters.type.length > 0 ? filters.type : undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    page,
    limit: MEDIA_PAGE_SIZE,
  });

  // Timeline reads the watch-session diary (type + search filter it; the
  // direction arrow sets oldest/newest order). The `enabled` gate skips the
  // request entirely until the timeline view is active, so grid/list visitors
  // never fetch it.
  const timeline = useSessionsTimeline(
    {
      type: filters.type.length > 0 ? filters.type : undefined,
      search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      order: filters.sortOrder === "asc" ? "asc" : "desc",
    },
    viewMode === "timeline",
  );

  const handleFilterChange = useCallback(
    (newFilters: MediaFilterValues) => {
      setFilters(newFilters);
      setPage(1);
      // Search is debounced; type/sort changes apply immediately via setFilters.
      scheduleSearch(newFilters.search);
    },
    [scheduleSearch],
  );

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

  const isTimeline = viewMode === "timeline";

  // The timeline is inherently chronological, so the sort segment (and its
  // direction toggle) drop out there; type + search stay live.
  const filterSegments: FilterSegment[] = useMemo(
    () => buildFilterSegments(filters, isTimeline, handleFilterChange),
    [filters, handleFilterChange, isTimeline],
  );

  const issueNumber = dashboardStats?.totalSessions ?? null;
  const eyebrow = issueNumber === null ? "CDb" : `CDb · Issue #${String(issueNumber)}`;

  const footnote = buildFootnote(data?.total, dashboardStats?.weeksSinceFirstSession ?? null);

  const sortDirection = buildSortDirection(filters, handleFilterChange, isTimeline);

  const filtersActive: FiltersActive = {
    hasSearch: filters.search.length > 0,
    hasType: filters.type.length > 0,
  };

  // The "end of issue" sign-off only appears once the active view has content;
  // an empty or still-loading archive has no issue to close out.
  const hasContent = isTimeline
    ? !timeline.isLoading && !timeline.isEmpty
    : !isLoading && data !== undefined && data.items.length > 0;

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
        direction={sortDirection}
        search={{
          value: filters.search,
          onChange: (value) => {
            handleFilterChange({ ...filters, search: value });
          },
        }}
        actions={
          <>
            <ViewToggle view={viewMode} onChange={setViewMode} />
            {isModeratorOrAdmin && (
              <RefreshControls
                progress={progress}
                onRefresh={() => {
                  void handleRefresh();
                }}
                onCancel={cancelRefresh}
              />
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

      {isTimeline ? (
        <TimelineArchive timeline={timeline} filtersActive={filtersActive} />
      ) : (
        <MediaArchive
          view={viewMode === "list" ? "list" : "grid"}
          data={data}
          isLoading={isLoading}
          page={page}
          onPageChange={setPage}
          filtersActive={filtersActive}
          onAddMedia={() => {
            setImportOpen(true);
          }}
        />
      )}

      {hasContent && <IssueFooter />}

      <ImportMediaDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
