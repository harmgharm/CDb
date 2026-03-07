"use client";

import {
  BookmarkCheckIcon,
  BookmarkPlusIcon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  LoaderIcon,
  SearchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { MediaInfoRow } from "@/components/media/media-card";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import type { SessionFormState } from "@/components/media/session-form-section";
import { SessionFormSection } from "@/components/media/session-form-section";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMediaImport, useMediaSearch } from "@/hooks/use-media";
import { useCreateSession } from "@/hooks/use-sessions";
import { useUserList } from "@/hooks/use-users";
import { useAddToWatchlist, useWatchlist } from "@/hooks/use-watchlist";
import type { MediaSearchResult } from "@/types/media";
import type { WatchlistResponse } from "@/types/watchlist-responses";

const ALL_VALUE = "__all__";
const GROUP_PICK_VALUE = "__group__";

interface ImportMediaDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess: () => void;
}

function todayString(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

interface WatchlistLookup {
  readonly mediaIds: Set<string>;
  readonly tmdbIds: Set<number>;
  readonly malIds: Set<number>;
}

function buildWatchlistLookup(watchlist: WatchlistResponse | undefined): WatchlistLookup {
  const lookup: WatchlistLookup = { mediaIds: new Set(), tmdbIds: new Set(), malIds: new Set() };
  if (watchlist === undefined) return lookup;
  for (const item of watchlist.items) {
    if (item.media_id !== null) lookup.mediaIds.add(item.media_id);
    if (item.tmdb_id !== null) lookup.tmdbIds.add(item.tmdb_id);
    if (item.mal_id !== null) lookup.malIds.add(item.mal_id);
  }
  return lookup;
}

/**
 * Check if a search result is already in the user's watchlist.
 * Matches by media_id (for imported) or tmdb_id/mal_id (for external).
 */
function isAlreadyWatchlisted(
  result: MediaSearchResult,
  importedMediaId: string | undefined,
  lookup: WatchlistLookup,
): boolean {
  if (importedMediaId !== undefined && lookup.mediaIds.has(importedMediaId)) {
    return true;
  }
  if (result.source === "tmdb") return lookup.tmdbIds.has(result.externalId);
  return lookup.malIds.has(result.externalId);
}

interface SearchResultsListProps {
  readonly isSearching: boolean;
  readonly query: string;
  readonly results: MediaSearchResult[];
  readonly importedMap: Map<string, string>;
  readonly locallyAdded: Set<string>;
  readonly watchlistLookup: WatchlistLookup;
  readonly isAddingToWatchlist: boolean;
  readonly isImporting: boolean;
  readonly onImport: (result: MediaSearchResult) => Promise<void>;
  readonly onAddToWatchlist: (
    result: MediaSearchResult,
    importedMediaId: string | undefined,
  ) => Promise<void>;
  readonly onNavigate: (mediaId: string) => void;
}

function SearchResultsList({
  isSearching,
  query,
  results,
  importedMap,
  locallyAdded,
  watchlistLookup,
  isAddingToWatchlist,
  isImporting,
  onImport,
  onAddToWatchlist,
  onNavigate,
}: SearchResultsListProps) {
  if (isSearching) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoaderIcon className="text-muted-foreground size-5 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">Searching...</span>
      </div>
    );
  }

  if (query.length > 0 && results.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No results found for &ldquo;{query}&rdquo;
      </p>
    );
  }

  if (query.length === 0 && results.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Start typing to search for movies, TV shows, or anime.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((result) => {
        const key = `${result.source}-${String(result.externalId)}`;
        const importedMediaId = importedMap.get(key);
        const isImported = importedMediaId !== undefined;
        const alreadyWatchlisted =
          locallyAdded.has(key) || isAlreadyWatchlisted(result, importedMediaId, watchlistLookup);

        return (
          <div
            key={key}
            role={isImported ? "link" : undefined}
            tabIndex={isImported ? 0 : undefined}
            className={`hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 transition-colors ${
              isImported ? "cursor-pointer" : ""
            }`}
            onClick={() => {
              if (isImported) onNavigate(importedMediaId);
            }}
            onKeyDown={(event) => {
              if (isImported && (event.key === "Enter" || event.key === " ")) {
                onNavigate(importedMediaId);
              }
            }}
          >
            <div className="min-w-0 flex-1">
              <MediaInfoRow
                posterUrl={result.posterUrl}
                title={result.title}
                type={result.type}
                releaseYear={result.releaseYear}
                overview={result.overview}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <MediaTypeBadge type={result.type} />
              {alreadyWatchlisted ? (
                <Button size="sm" variant="outline" disabled>
                  <BookmarkCheckIcon className="mr-1 size-3" />
                  Watchlisted
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isAddingToWatchlist}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onAddToWatchlist(result, importedMediaId);
                  }}
                >
                  <BookmarkPlusIcon className="mr-1 size-3" />
                  Watchlist
                </Button>
              )}
              {importedMediaId === undefined ? (
                <Button
                  size="sm"
                  disabled={isImporting}
                  onClick={() => {
                    void onImport(result);
                  }}
                >
                  {isImporting ? (
                    <LoaderIcon className="mr-1 size-3 animate-spin" />
                  ) : (
                    <DownloadIcon className="mr-1 size-3" />
                  )}
                  Import
                </Button>
              ) : (
                <Button size="sm" variant="outline">
                  <CheckIcon className="mr-1 size-3" />
                  Added
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ImportMediaDialog({ open, onOpenChange, onSuccess }: ImportMediaDialogProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { data: users } = useUserList();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [importedMap, setImportedMap] = useState<Map<string, string>>(new Map());
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionTarget, setSessionTarget] = useState<{ mediaId: string; title: string } | null>(
    null,
  );
  const [sessionForm, setSessionForm] = useState<SessionFormState>({
    dateWatched: todayString(),
    timeWatched: "",
    pickerId: "",
    attendeeIds: [],
    notes: "",
  });
  const { results, isSearching, searchError, search, clearResults } = useMediaSearch();
  const { isImporting, importError, importMedia } = useMediaImport();
  const { createSession, isCreating } = useCreateSession();
  const { addToWatchlist, isAdding: isAddingToWatchlist } = useAddToWatchlist();
  const { data: myWatchlist, mutate: mutateWatchlist } = useWatchlist(
    currentUser === null ? {} : { userId: currentUser.id, limit: 100 },
  );
  // Track items added during this dialog session (SWR may not have refreshed yet)
  const [locallyAdded, setLocallyAdded] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const watchlistLookup = buildWatchlistLookup(myWatchlist);

  const resetSessionForm = useCallback(() => {
    setSessionOpen(false);
    setSessionTarget(null);
    setSessionForm({
      dateWatched: todayString(),
      timeWatched: "",
      pickerId: "",
      attendeeIds: currentUser === null ? [] : [currentUser.id],
      notes: "",
    });
  }, [currentUser]);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceRef.current !== undefined) {
        clearTimeout(debounceRef.current);
      }

      if (value.trim().length === 0) {
        clearResults();
        return;
      }

      debounceRef.current = setTimeout(() => {
        void search(value, typeFilter.length > 0 ? typeFilter : undefined);
      }, 400);
    },
    [typeFilter, search, clearResults],
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      const newType = value === ALL_VALUE ? "" : value;
      setTypeFilter(newType);
      if (query.trim().length > 0) {
        void search(query, newType.length > 0 ? newType : undefined);
      }
    },
    [query, search],
  );

  const handleImport = useCallback(
    async (result: MediaSearchResult) => {
      const params: { type: string; tmdbId?: number; malId?: number } = {
        type: result.type,
      };

      if (result.source === "tmdb") {
        params.tmdbId = result.externalId;
      } else {
        params.malId = result.externalId;
      }

      const imported = await importMedia(params);

      if (imported !== null) {
        const key = `${result.source}-${String(result.externalId)}`;
        setImportedMap((previous) => new Map([...previous, [key, imported.id]]));
        toast.success(`Imported "${result.title}"`);
        onSuccess();

        // Show session form for this media
        setSessionTarget({ mediaId: imported.id, title: result.title });
        setSessionForm((previous) => ({
          ...previous,
          attendeeIds: currentUser === null ? [] : [currentUser.id],
        }));
        setSessionOpen(true);
      }
    },
    [importMedia, onSuccess, currentUser],
  );

  async function handleCreateSession() {
    if (sessionTarget === null) return;

    if (sessionForm.attendeeIds.length === 0) {
      toast.error("Select at least one attendee");
      return;
    }

    const isGroupPick =
      sessionForm.pickerId.length === 0 || sessionForm.pickerId === GROUP_PICK_VALUE;

    const finalAttendees =
      isGroupPick || sessionForm.attendeeIds.includes(sessionForm.pickerId)
        ? sessionForm.attendeeIds
        : [...sessionForm.attendeeIds, sessionForm.pickerId];

    const success = await createSession({
      mediaId: sessionTarget.mediaId,
      dateWatched: sessionForm.dateWatched,
      timeWatchedAt: sessionForm.timeWatched.length > 0 ? sessionForm.timeWatched : undefined,
      pickedByUserId: isGroupPick ? null : sessionForm.pickerId,
      attendeeIds: finalAttendees,
      notes: sessionForm.notes.length > 0 ? sessionForm.notes : undefined,
    });

    if (success) {
      const isAttendee = currentUser !== null && finalAttendees.includes(currentUser.id);
      const mediaId = sessionTarget.mediaId;

      if (isAttendee) {
        toast.success("Watch session created", {
          action: {
            label: "Rate now",
            onClick: () => {
              handleOpenChange(false);
              router.push(`/database/${mediaId}`);
            },
          },
        });
      } else {
        toast.success("Watch session created");
      }

      resetSessionForm();
      onSuccess();
    } else {
      toast.error("Failed to create session");
    }
  }

  async function handleAddToWatchlist(
    result: MediaSearchResult,
    importedMediaId: string | undefined,
  ) {
    const watchlistParams =
      importedMediaId === undefined
        ? {
            ...(result.source === "tmdb"
              ? { tmdbId: result.externalId }
              : { malId: result.externalId }),
            extTitle: result.title,
            extPosterUrl: result.posterUrl,
            extMediaType: result.type,
          }
        : { mediaId: importedMediaId };
    const entry = await addToWatchlist(watchlistParams);
    const key = `${result.source}-${String(result.externalId)}`;
    if (entry === null) {
      toast.error("Failed to add to watchlist");
      return;
    }
    setLocallyAdded((previous) => new Set([...previous, key]));
    void mutateWatchlist();
    toast.success("Added to watchlist");
  }

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setQuery("");
        setTypeFilter("");
        clearResults();
        resetSessionForm();
        setLocallyAdded(new Set());
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, clearResults, resetSessionForm],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Media</DialogTitle>
          <DialogDescription>
            Search TMDB and MyAnimeList to import movies, shows, and anime.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search for a title..."
              value={query}
              onChange={(event) => {
                handleSearch(event.target.value);
              }}
              className="pl-9"
              autoFocus
            />
          </div>
          <Select
            value={typeFilter.length > 0 ? typeFilter : ALL_VALUE}
            onValueChange={handleTypeChange}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All types</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
              <SelectItem value="tv">TV Shows</SelectItem>
              <SelectItem value="anime">Anime</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(searchError !== null || importError !== null) && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {searchError ?? importError}
          </div>
        )}

        {/* Session form after import */}
        {sessionTarget !== null && (
          <Collapsible open={sessionOpen} onOpenChange={setSessionOpen}>
            <div className="rounded-md border p-3">
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span className="text-sm font-medium">
                  Log first session for &ldquo;{sessionTarget.title}&rdquo;
                </span>
                <ChevronDownIcon
                  className={`text-muted-foreground size-4 transition-transform ${
                    sessionOpen ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SessionFormSection
                  state={sessionForm}
                  onChange={setSessionForm}
                  users={users ?? []}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resetSessionForm();
                    }}
                  >
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    disabled={isCreating}
                    onClick={() => {
                      void handleCreateSession();
                    }}
                  >
                    {isCreating ? "Creating..." : "Create Session"}
                  </Button>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        <div className="max-h-[50vh] overflow-y-auto">
          <SearchResultsList
            isSearching={isSearching}
            query={query}
            results={results}
            importedMap={importedMap}
            locallyAdded={locallyAdded}
            watchlistLookup={watchlistLookup}
            isAddingToWatchlist={isAddingToWatchlist}
            isImporting={isImporting}
            onImport={handleImport}
            onAddToWatchlist={handleAddToWatchlist}
            onNavigate={(mediaId) => {
              handleOpenChange(false);
              router.push(`/database/${mediaId}`);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
