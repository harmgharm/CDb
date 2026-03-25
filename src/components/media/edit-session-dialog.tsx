"use client";

import { useState } from "react";
import { toast } from "sonner";

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
import { useUpdateSession, useUpdateSessionAttendees } from "@/hooks/use-sessions";
import { useUserList } from "@/hooks/use-users";
import type { MediaSession } from "@/types/media-responses";
import type { UserListItem } from "@/types/user-responses";

const GROUP_PICK_VALUE = "__group__";

interface EditSessionDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly session: MediaSession;
  readonly onSaved: () => void;
}

function getInitials(user: UserListItem): string {
  const name = user.display_name ?? user.username;
  return name.slice(0, 2).toUpperCase();
}

function formatDateForInput(dateString: string): string {
  return new Date(dateString).toISOString().split("T")[0] ?? "";
}

export function EditSessionDialog({
  open,
  onOpenChange,
  session,
  onSaved,
}: EditSessionDialogProps) {
  const { data: users } = useUserList();
  const { updateSession, isUpdating } = useUpdateSession();
  const { updateAttendees, isUpdating: isUpdatingAttendees } = useUpdateSessionAttendees();

  const originalAttendeeIds = session.attendees.map((a) => a.user_id);

  const [dateWatched, setDateWatched] = useState(
    session.date_watched === null ? "" : formatDateForInput(session.date_watched),
  );
  const [timeWatched, setTimeWatched] = useState(session.time_watched_at ?? "");
  const [pickerId, setPickerId] = useState(session.picker_id ?? GROUP_PICK_VALUE);
  const [attendeeIds, setAttendeeIds] = useState<string[]>(originalAttendeeIds);
  const [notes, setNotes] = useState(session.notes ?? "");

  function toggleAttendee(userId: string) {
    setAttendeeIds((previous) =>
      previous.includes(userId) ? previous.filter((id) => id !== userId) : [...previous, userId],
    );
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (attendeeIds.length === 0) {
      toast.error("Select at least one attendee");
      return;
    }

    const isGroupPick = pickerId.length === 0 || pickerId === GROUP_PICK_VALUE;

    // Diff attendees
    const added = attendeeIds.filter((id) => !originalAttendeeIds.includes(id));
    const removed = originalAttendeeIds.filter((id) => !attendeeIds.includes(id));
    const hasAttendeeChanges = added.length > 0 || removed.length > 0;

    // Run session update and attendee updates in parallel
    const results = await Promise.all([
      updateSession(session.id, {
        dateWatched: dateWatched.length > 0 ? dateWatched : null,
        timeWatchedAt: timeWatched.length > 0 ? timeWatched : null,
        pickedByUserId: isGroupPick ? null : pickerId,
        notes: notes.length > 0 ? notes : null,
      }),
      hasAttendeeChanges ? updateAttendees(session.id, added, removed) : Promise.resolve(true),
    ]);

    const allSucceeded = results.every(Boolean);

    if (allSucceeded) {
      toast.success("Session updated");
      onOpenChange(false);
      onSaved();
    } else {
      toast.error("Failed to update session");
    }
  }

  const isSaving = isUpdating || isUpdatingAttendees;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Watch Session</DialogTitle>
          <DialogDescription>Update the details for this watch session.</DialogDescription>
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
              <Label htmlFor="edit-date-watched">Date Watched (optional)</Label>
              <Input
                id="edit-date-watched"
                type="date"
                value={dateWatched}
                onChange={(event) => {
                  setDateWatched(event.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time-watched">Time (optional)</Label>
              <Input
                id="edit-time-watched"
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
                    <div className="flex items-center gap-2">
                      <Avatar className="size-5">
                        <AvatarImage
                          src={user.avatar_url ?? undefined}
                          alt={user.display_name ?? user.username}
                        />
                        <AvatarFallback className="text-[9px]">{getInitials(user)}</AvatarFallback>
                      </Avatar>
                      {user.display_name ?? user.username}
                    </div>
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
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="edit-session-notes">Notes (optional)</Label>
            <Textarea
              id="edit-session-notes"
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
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface AttendeeListProps {
  readonly users: readonly UserListItem[];
  readonly attendeeIds: readonly string[];
  readonly onToggle: (userId: string) => void;
}

function AttendeeList({ users, attendeeIds, onToggle }: AttendeeListProps) {
  if (users.length === 0) {
    return <p className="text-muted-foreground text-sm">Loading users...</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {users.map((user) => (
        <label
          key={user.id}
          className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md p-1.5 transition-colors"
        >
          <Checkbox
            checked={attendeeIds.includes(user.id)}
            onCheckedChange={() => {
              onToggle(user.id);
            }}
          />
          <Avatar className="size-6">
            <AvatarImage
              src={user.avatar_url ?? undefined}
              alt={user.display_name ?? user.username}
            />
            <AvatarFallback className="text-[10px]">{getInitials(user)}</AvatarFallback>
          </Avatar>
          <span className="text-sm">{user.display_name ?? user.username}</span>
        </label>
      ))}
    </div>
  );
}
