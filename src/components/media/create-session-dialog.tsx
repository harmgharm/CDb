"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

interface CreateSessionDialogProps {
  readonly mediaId: string;
  readonly mediaTitle: string;
  readonly onCreated: () => void;
}

function getInitials(user: UserListItem): string {
  const name = user.display_name ?? user.username;
  return name.slice(0, 2).toUpperCase();
}

function todayString(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

export function CreateSessionDialog({ mediaId, mediaTitle, onCreated }: CreateSessionDialogProps) {
  const { user: currentUser } = useAuth();
  const { data: users } = useUserList();
  const { createSession, isCreating } = useCreateSession();

  const [open, setOpen] = useState(false);
  const [dateWatched, setDateWatched] = useState(todayString);
  const [timeWatched, setTimeWatched] = useState("");
  const [pickerId, setPickerId] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  function resetForm() {
    setDateWatched(todayString());
    setTimeWatched("");
    setPickerId("");
    setAttendeeIds([]);
    setNotes("");
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

    // Ensure picker is in attendees (if a specific picker was chosen)
    const finalAttendees =
      isGroupPick || attendeeIds.includes(pickerId) ? attendeeIds : [...attendeeIds, pickerId];

    const success = await createSession({
      mediaId,
      dateWatched,
      timeWatchedAt: timeWatched.length > 0 ? timeWatched : undefined,
      pickedByUserId: isGroupPick ? null : pickerId,
      attendeeIds: finalAttendees,
      notes: notes.length > 0 ? notes : undefined,
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
              <Label htmlFor="date-watched">Date Watched</Label>
              <Input
                id="date-watched"
                type="date"
                value={dateWatched}
                onChange={(event) => {
                  setDateWatched(event.target.value);
                }}
                required
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
            <AvatarFallback className="text-[10px]">{getInitials(user)}</AvatarFallback>
          </Avatar>
          <span className="text-sm">{user.display_name ?? user.username}</span>
        </label>
      ))}
    </div>
  );
}
