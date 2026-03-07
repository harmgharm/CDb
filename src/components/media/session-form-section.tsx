"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

/** Only allow valid rating input: empty, integers 1-10, or one decimal place (e.g. 7.3) */
const RATING_INPUT_PATTERN = /^(?:[1-9](?:\.\d?)?|10(?:\.0?)?)$/;

function sanitizeRatingInput(value: string): string | null {
  if (value.length === 0 || RATING_INPUT_PATTERN.test(value)) return value;
  return null;
}

export interface SessionFormState {
  readonly dateWatched: string;
  readonly timeWatched: string;
  readonly pickerId: string;
  readonly attendeeIds: string[];
  readonly notes: string;
  readonly inlineRatings: Record<string, string>;
}

function getInitials(user: UserListItem): string {
  const name = user.display_name ?? user.username;
  return name.slice(0, 2).toUpperCase();
}

interface SessionFormSectionProps {
  readonly state: SessionFormState;
  readonly onChange: (state: SessionFormState) => void;
  readonly users: UserListItem[];
  readonly currentUserId: string | null;
  readonly canRateForOthers: boolean;
}

export function SessionFormSection({
  state,
  onChange,
  users,
  currentUserId,
  canRateForOthers,
}: SessionFormSectionProps) {
  function toggleAttendee(userId: string) {
    if (state.attendeeIds.includes(userId)) {
      const updatedRatings = Object.fromEntries(
        Object.entries(state.inlineRatings).filter(([key]) => key !== userId),
      );
      onChange({
        ...state,
        attendeeIds: state.attendeeIds.filter((id) => id !== userId),
        inlineRatings: updatedRatings,
      });
    } else {
      onChange({ ...state, attendeeIds: [...state.attendeeIds, userId] });
    }
  }

  function updateRating(userId: string, value: string) {
    const sanitized = sanitizeRatingInput(value);
    if (sanitized === null) return;
    onChange({ ...state, inlineRatings: { ...state.inlineRatings, [userId]: sanitized } });
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
        <div className="grid gap-1.5 rounded-md border p-2">
          {users.map((user) => {
            const isChecked = state.attendeeIds.includes(user.id);
            const showRating = isChecked && (canRateForOthers || user.id === currentUserId);

            return (
              <div key={user.id} className="flex items-center gap-2">
                <label className="hover:bg-accent/50 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md p-1 transition-colors">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => {
                      toggleAttendee(user.id);
                    }}
                  />
                  <Avatar className="size-5 shrink-0">
                    <AvatarImage
                      src={user.avatar_url ?? undefined}
                      alt={user.display_name ?? user.username}
                    />
                    <AvatarFallback className="text-[9px]">{getInitials(user)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-xs">{user.display_name ?? user.username}</span>
                </label>
                {showRating && (
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="Rating"
                    value={state.inlineRatings[user.id] ?? ""}
                    onChange={(event) => {
                      updateRating(user.id, event.target.value);
                    }}
                    className="h-7 w-20 shrink-0 text-xs"
                  />
                )}
              </div>
            );
          })}
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
