"use client";

import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
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
}

function todayString(): string {
  return new Date().toISOString().split("T")[0] ?? "";
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
    inlineRatings: {},
  });

  const canRateForOthers =
    currentUser !== null && (currentUser.role === "admin" || currentUser.role === "moderator");
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

    // Build inline ratings from filled-in fields
    const ratings = Object.entries(sessionForm.inlineRatings)
      .filter(([, value]) => value.length > 0)
      .map(([userId, value]) => ({ userId, score: Number(value) }))
      .filter(({ score }) => !Number.isNaN(score) && score >= 1 && score <= 10);

    const success = await createSession({
      mediaId: sessionTarget.mediaId,
      dateWatched: sessionForm.dateWatched,
      timeWatchedAt: sessionForm.timeWatched.length > 0 ? sessionForm.timeWatched : undefined,
      pickedByUserId: isGroupPick ? null : sessionForm.pickerId,
      attendeeIds: finalAttendees,
      notes: sessionForm.notes.length > 0 ? sessionForm.notes : undefined,
      ratings: ratings.length > 0 ? ratings : undefined,
    });

    if (success) {
      const isAttendee = currentUser !== null && finalAttendees.includes(currentUser.id);
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
