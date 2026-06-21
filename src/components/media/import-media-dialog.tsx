"use client";

import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { buildWatchlistLookup, SearchResultsList } from "@/components/media/search-results-list";
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
import { useProposeToQueue, useQueue } from "@/hooks/use-queue";
import { useCreateSession } from "@/hooks/use-sessions";
import { useUserList } from "@/hooks/use-users";
import { useAddToWatchlist, useWatchlist } from "@/hooks/use-watchlist";
import type { MediaSearchResult } from "@/types/media";

const ALL_VALUE = "__all__";
const GROUP_PICK_VALUE = "__group__";

interface ImportMediaDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess: () => void;
  readonly initialQuery?: string;
}

export function ImportMediaDialog({
  open,
  onOpenChange,
  onSuccess,
  initialQuery = "",
}: ImportMediaDialogProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { data: users } = useUserList();
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState("");
  const [importedMap, setImportedMap] = useState<Map<string, string>>(new Map());
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionTarget, setSessionTarget] = useState<{ mediaId: string; title: string } | null>(
    null,
  );
  const [sessionForm, setSessionForm] = useState<SessionFormState>({
    dateWatched: "",
    timeWatched: "",
    pickerId: "",
    attendeeIds: [],
    notes: "",
    inlineRatings: {},
  });

  const canRateForOthers =
    currentUser !== null && (currentUser.role === "admin" || currentUser.role === "moderator");
  const { results, isSearching, searchError, search, clearResults, existingMediaMap } =
    useMediaSearch();
  const { isImporting, importError, importMedia } = useMediaImport();
  const { createSession, isCreating } = useCreateSession();
  const { addToWatchlist, isAdding: isAddingToWatchlist } = useAddToWatchlist();
  const { propose, isProposing } = useProposeToQueue();
  const { scheduled, proposals, refresh: refreshQueue } = useQueue();
  const { data: myWatchlist, mutate: mutateWatchlist } = useWatchlist(
    currentUser === null ? {} : { userId: currentUser.id, limit: 100 },
  );
  // Track items added during this dialog session (SWR may not have refreshed yet)
  const [locallyAdded, setLocallyAdded] = useState<Set<string>>(new Set());
  // Same, for titles proposed to the group queue during this dialog session.
  const [locallyProposed, setLocallyProposed] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-search when dialog mounts with an initialQuery.
  // Callers should use a `key` prop to ensure a fresh mount per query.
  useEffect(() => {
    if (initialQuery.length > 0) {
      void search(initialQuery);
    }
  }, [initialQuery, search]);

  // Merge DB-persisted existing media with session-local imports
  const mergedImportedMap = useMemo(() => {
    const merged = new Map(existingMediaMap);
    for (const [key, value] of importedMap) {
      merged.set(key, value);
    }
    return merged;
  }, [existingMediaMap, importedMap]);

  const watchlistLookup = buildWatchlistLookup(myWatchlist);

  // The set of media ids currently active in the group queue (scheduled pick +
  // open proposals). A search row matching one renders the "Proposed" state.
  const queuedMediaIds = useMemo(() => {
    const ids = new Set<string>();
    if (scheduled !== null) ids.add(scheduled.media.id);
    for (const proposal of proposals) ids.add(proposal.media.id);
    return ids;
  }, [scheduled, proposals]);

  const resetSessionForm = useCallback(() => {
    setSessionOpen(false);
    setSessionTarget(null);
    setSessionForm({
      dateWatched: "",
      timeWatched: "",
      pickerId: "",
      attendeeIds: currentUser === null ? [] : [currentUser.id],
      notes: "",
      inlineRatings: {},
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

  // Bare import: import the media row and record it locally, WITHOUT popping the
  // post-import session form. Returns the imported id (or null). Shared by the
  // explicit Import button (which then opens the form) and the Propose path
  // (which must import an external title first but must NOT open the form).
  const importResult = useCallback(
    async (result: MediaSearchResult): Promise<string | null> => {
      const params: { type: string; tmdbId?: number; malId?: number } = {
        type: result.type,
      };

      if (result.source === "tmdb") {
        params.tmdbId = result.externalId;
      } else {
        params.malId = result.externalId;
      }

      const imported = await importMedia(params);
      if (imported === null) {
        return null;
      }
      const key = `${result.source}-${String(result.externalId)}`;
      setImportedMap((previous) => new Map([...previous, [key, imported.id]]));
      onSuccess();
      return imported.id;
    },
    [importMedia, onSuccess],
  );

  const handleImport = useCallback(
    async (result: MediaSearchResult) => {
      const importedId = await importResult(result);

      if (importedId !== null) {
        toast.success(`Imported "${result.title}"`);

        // Show session form for this media
        setSessionTarget({ mediaId: importedId, title: result.title });
        setSessionForm((previous) => ({
          ...previous,
          attendeeIds: currentUser === null ? [] : [currentUser.id],
        }));
        setSessionOpen(true);
      }
    },
    [importResult, currentUser],
  );

  function buildSessionParams(target: { mediaId: string }) {
    const isGroupPick =
      sessionForm.pickerId.length === 0 || sessionForm.pickerId === GROUP_PICK_VALUE;

    const ratings = Object.entries(sessionForm.inlineRatings)
      .filter(([, value]) => value.length > 0)
      .map(([userId, value]) => ({ userId, score: Number(value) }))
      .filter(({ score }) => !Number.isNaN(score) && score >= 1 && score <= 10);

    return {
      params: {
        mediaId: target.mediaId,
        dateWatched: sessionForm.dateWatched.length > 0 ? sessionForm.dateWatched : undefined,
        timeWatchedAt: sessionForm.timeWatched.length > 0 ? sessionForm.timeWatched : undefined,
        pickedByUserId: isGroupPick ? null : sessionForm.pickerId,
        attendeeIds: sessionForm.attendeeIds,
        notes: sessionForm.notes.length > 0 ? sessionForm.notes : undefined,
        ratings: ratings.length > 0 ? ratings : undefined,
      },
      ratings,
    };
  }

  async function handleCreateSession() {
    if (sessionTarget === null) return;

    if (sessionForm.attendeeIds.length === 0) {
      toast.error("Select at least one attendee");
      return;
    }

    const { params, ratings } = buildSessionParams(sessionTarget);
    const success = await createSession(params);

    if (success) {
      const isAttendee = currentUser !== null && sessionForm.attendeeIds.includes(currentUser.id);
      const alreadyRated = currentUser !== null && ratings.some((r) => r.userId === currentUser.id);
      const mediaId = sessionTarget.mediaId;

      if (isAttendee && !alreadyRated) {
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

  async function handlePropose(result: MediaSearchResult, importedMediaId: string | undefined) {
    // The queue needs a real media row. If the result isn't imported yet, import
    // it first (without popping the session form), then propose the new id.
    const mediaId = importedMediaId ?? (await importResult(result));
    if (mediaId === null) {
      toast.error("Couldn't import that title to propose it");
      return;
    }

    const outcome = await propose(mediaId);
    if (outcome === null) {
      toast.error("Couldn't propose that title");
      return;
    }

    const key = `${result.source}-${String(result.externalId)}`;
    setLocallyProposed((previous) => new Set([...previous, key]));
    void refreshQueue();
    toast.success(outcome.alreadyProposed ? "Already in the queue" : "Proposed to the group");
  }

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setQuery("");
        setTypeFilter("");
        clearResults();
        resetSessionForm();
        setLocallyAdded(new Set());
        setLocallyProposed(new Set());
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
                  currentUserId={currentUser?.id ?? null}
                  canRateForOthers={canRateForOthers}
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
            importedMap={mergedImportedMap}
            locallyAdded={locallyAdded}
            watchlistLookup={watchlistLookup}
            isAddingToWatchlist={isAddingToWatchlist}
            isImporting={isImporting}
            queuedMediaIds={queuedMediaIds}
            locallyProposed={locallyProposed}
            isProposing={isProposing}
            onImport={handleImport}
            onAddToWatchlist={handleAddToWatchlist}
            onPropose={handlePropose}
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
