"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSession } from "@/hooks/use-sessions";
import { useUserList } from "@/hooks/use-users";
import type { UserListItem } from "@/types/user-responses";

const GROUP_PICK_VALUE = "__group__";

/** Only allow valid rating input: empty, integers 1-10, or one decimal place (e.g. 7.3) */
const RATING_INPUT_PATTERN = /^(?:[1-9](?:\.\d?)?|10(?:\.0?)?)$/;

function sanitizeRatingInput(value: string): string | null {
  if (value.length === 0 || RATING_INPUT_PATTERN.test(value)) return value;
  return null;
}

interface CreateSessionDialogProps {
  readonly mediaId: string;
  readonly mediaTitle: string;
  readonly onCreated: () => void;
}

function getInitials(user: UserListItem): string {
  const name = user.display_name ?? user.username;
  return name.slice(0, 2).toUpperCase();
}

export function CreateSessionDialog({ mediaId, mediaTitle, onCreated }: CreateSessionDialogProps) {
  const { user: currentUser } = useAuth();
  const { data: users } = useUserList();
  const { createSession, isCreating } = useCreateSession();

  const [open, setOpen] = useState(false);
  const [dateWatched, setDateWatched] = useState("");
  const [timeWatched, setTimeWatched] = useState("");
  const [pickerId, setPickerId] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [inlineRatings, setInlineRatings] = useState<Record<string, string>>({});

  const canRateForOthers =
    currentUser !== null && (currentUser.role === "admin" || currentUser.role === "moderator");

  function resetForm() {
    setDateWatched("");
    setTimeWatched("");
    setPickerId("");
    setAttendeeIds([]);
    setNotes("");
    setInlineRatings({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetForm();
      // Pre-select current user as attendee
      if (currentUser !== null) {
        setAttendeeIds([currentUser.id]);
      }
    }
  }

  function clearRatingForUser(userId: string) {
    setInlineRatings((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([key]) => key !== userId)),
    );
  }

  function toggleAttendee(userId: string) {
    setAttendeeIds((previous) => {
      if (previous.includes(userId)) {
        clearRatingForUser(userId);
        return previous.filter((id) => id !== userId);
      }
      return [...previous, userId];
    });
  }

  function updateInlineRating(userId: string, value: string) {
    const sanitized = sanitizeRatingInput(value);
    if (sanitized === null) return;
    setInlineRatings((previous) => ({ ...previous, [userId]: sanitized }));
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (attendeeIds.length === 0) {
      toast.error("Select at least one attendee");
      return;
    }

    const isGroupPick = pickerId.length === 0 || pickerId === GROUP_PICK_VALUE;

    // Build inline ratings from filled-in fields
    const ratings = Object.entries(inlineRatings)
      .filter(([, value]) => value.length > 0)
      .map(([userId, value]) => ({ userId, score: Number(value) }))
      .filter(({ score }) => !Number.isNaN(score) && score >= 1 && score <= 10);

    const success = await createSession({
      mediaId,
      dateWatched: dateWatched.length > 0 ? dateWatched : undefined,
      timeWatchedAt: timeWatched.length > 0 ? timeWatched : undefined,
      pickedByUserId: isGroupPick ? null : pickerId,
      attendeeIds,
      notes: notes.length > 0 ? notes : undefined,
      ratings: ratings.length > 0 ? ratings : undefined,
    });

    if (success) {
      toast.success("Watch session created");
      setOpen(false);
      onCreated();
    } else {
      toast.error("Failed to create session");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-1.5 size-4" />
          Log Session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Watch Session</DialogTitle>
          <DialogDescription>
            Record a watch session for <span className="font-medium">{mediaTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          {/* Date & Time */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date-watched">Date Watched (optional)</Label>
              <Input
                id="date-watched"
                type="date"
                value={dateWatched}
                onChange={(event) => {
                  setDateWatched(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time-watched">Time (optional)</Label>
              <Input
                id="time-watched"
                type="time"
                value={timeWatched}
                onChange={(event) => {
                  setTimeWatched(event.target.value);
                }}
              />
            </div>
          </div>

          {/* Picker */}
          <div className="space-y-2">
            <Label>Who Picked?</Label>
            <Select value={pickerId} onValueChange={setPickerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select the picker..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GROUP_PICK_VALUE}>
                  <span className="text-muted-foreground">Group pick (no specific picker)</span>
                </SelectItem>
                {(users ?? []).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.display_name ?? user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <Label>Who Watched?</Label>
            <div className="rounded-md border p-3">
              <AttendeeList
                users={users ?? []}
                attendeeIds={attendeeIds}
                onToggle={toggleAttendee}
                inlineRatings={inlineRatings}
                onRatingChange={updateInlineRating}
                currentUserId={currentUser?.id ?? null}
                canRateForOthers={canRateForOthers}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="session-notes">Notes (optional)</Label>
            <Textarea
              id="session-notes"
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
              placeholder="Any thoughts about this watch session..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface AttendeeListProps {
  readonly users: UserListItem[];
  readonly attendeeIds: string[];
  readonly onToggle: (userId: string) => void;
  readonly inlineRatings: Record<string, string>;
  readonly onRatingChange: (userId: string, value: string) => void;
  readonly currentUserId: string | null;
  readonly canRateForOthers: boolean;
}

function AttendeeList({
  users,
  attendeeIds,
  onToggle,
  inlineRatings,
  onRatingChange,
  currentUserId,
  canRateForOthers,
}: AttendeeListProps) {
  if (users.length === 0) {
    return <p className="text-muted-foreground text-sm">Loading users...</p>;
  }

  return (
    <div className="grid gap-2">
      {users.map((user) => {
        const isChecked = attendeeIds.includes(user.id);
        const showRating = isChecked && (canRateForOthers || user.id === currentUserId);

        return (
          <div key={user.id} className="flex items-center gap-2">
            <label className="hover:bg-accent/50 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md p-1.5 transition-colors">
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => {
                  onToggle(user.id);
                }}
              />
              <Avatar className="size-6 shrink-0">
                <AvatarImage
                  src={user.avatar_url ?? undefined}
                  alt={user.display_name ?? user.username}
                />
                <AvatarFallback className="text-[10px]">{getInitials(user)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{user.display_name ?? user.username}</span>
            </label>
            {showRating && (
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Rating"
                value={inlineRatings[user.id] ?? ""}
                onChange={(event) => {
                  onRatingChange(user.id, event.target.value);
                }}
                className="h-8 w-20 shrink-0 text-sm"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
