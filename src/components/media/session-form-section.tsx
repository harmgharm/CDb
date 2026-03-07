"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { UserListItem } from "@/types/user-responses";

const GROUP_PICK_VALUE = "__group__";

export interface SessionFormState {
  readonly dateWatched: string;
  readonly timeWatched: string;
  readonly pickerId: string;
  readonly attendeeIds: string[];
  readonly notes: string;
}

function getInitials(user: UserListItem): string {
  const name = user.display_name ?? user.username;
  return name.slice(0, 2).toUpperCase();
}

interface SessionFormSectionProps {
  readonly state: SessionFormState;
  readonly onChange: (state: SessionFormState) => void;
  readonly users: UserListItem[];
}

export function SessionFormSection({ state, onChange, users }: SessionFormSectionProps) {
  function toggleAttendee(userId: string) {
    const updated = state.attendeeIds.includes(userId)
      ? state.attendeeIds.filter((id) => id !== userId)
      : [...state.attendeeIds, userId];
    onChange({ ...state, attendeeIds: updated });
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="import-date" className="text-xs">
            Date Watched
          </Label>
          <Input
            id="import-date"
            type="date"
            value={state.dateWatched}
            onChange={(event) => {
              onChange({ ...state, dateWatched: event.target.value });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="import-time" className="text-xs">
            Time (optional)
          </Label>
          <Input
            id="import-time"
            type="time"
            value={state.timeWatched}
            onChange={(event) => {
              onChange({ ...state, timeWatched: event.target.value });
            }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Who Picked?</Label>
        <Select
          value={state.pickerId}
          onValueChange={(value) => {
            onChange({ ...state, pickerId: value });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select the picker..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GROUP_PICK_VALUE}>
              <span className="text-muted-foreground">Group pick (no specific picker)</span>
            </SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.display_name ?? user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Who Watched?</Label>
        <div className="grid gap-1.5 rounded-md border p-2 sm:grid-cols-2">
          {users.map((user) => (
            <label
              key={user.id}
              className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-md p-1 transition-colors"
            >
              <Checkbox
                checked={state.attendeeIds.includes(user.id)}
                onCheckedChange={() => {
                  toggleAttendee(user.id);
                }}
              />
              <Avatar className="size-5">
                <AvatarFallback className="text-[9px]">{getInitials(user)}</AvatarFallback>
              </Avatar>
              <span className="text-xs">{user.display_name ?? user.username}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="import-notes" className="text-xs">
          Notes (optional)
        </Label>
        <Textarea
          id="import-notes"
          value={state.notes}
          onChange={(event) => {
            onChange({ ...state, notes: event.target.value });
          }}
          placeholder="Any thoughts about this watch session..."
          rows={2}
        />
      </div>
    </div>
  );
}
