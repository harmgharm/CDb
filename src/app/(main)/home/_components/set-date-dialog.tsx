"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
import { toDateInputValue } from "@/hooks/use-queue";

interface SetDateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Title shown in the header (e.g. the media title). */
  readonly mediaTitle: string;
  /** Current scheduled date (ISO/wire shape) or null when dateless. */
  readonly currentDate: string | null;
  /** Commit a new date ("YYYY-MM-DD") or clear it (null). */
  readonly onSave: (date: string | null) => void;
}

export function SetDateDialog({
  open,
  onOpenChange,
  mediaTitle,
  currentDate,
  onSave,
}: SetDateDialogProps) {
  // Seeded once from the prop; the parent gives this dialog a `key` per pick so
  // it remounts (and re-seeds) rather than syncing via an effect.
  const [value, setValue] = useState(toDateInputValue(currentDate));

  const handleSave = (): void => {
    onSave(value.length > 0 ? value : null);
    onOpenChange(false);
  };

  const handleClear = (): void => {
    onSave(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule “{mediaTitle}”</DialogTitle>
          <DialogDescription>
            Pick a date for this watch, or clear it to leave it open.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="queue-schedule-date" className="text-xs">
            Date
          </Label>
          <Input
            id="queue-schedule-date"
            type="date"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </div>
        <DialogFooter className="sm:justify-between">
          {currentDate === null ? (
            <span />
          ) : (
            <Button variant="ghost" onClick={handleClear}>
              Clear date
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
