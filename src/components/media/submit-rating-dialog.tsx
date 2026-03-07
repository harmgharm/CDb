"use client";

import { StarIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitRating } from "@/hooks/use-sessions";

interface OnBehalfOfUser {
  readonly id: string;
  readonly name: string;
}

interface SubmitRatingDialogProps {
  readonly sessionId: string;
  readonly mediaTitle: string;
  readonly dateWatched: string;
  readonly onRated: () => void;
  readonly onBehalfOf?: OnBehalfOfUser;
}

// ============================================
// Score Selector (shared component)
// ============================================

interface ScoreSelectorProps {
  readonly score: number;
  readonly onSelect: (score: number) => void;
}

function formatScore(score: number): string {
  return score % 1 === 0 ? String(score) : score.toFixed(1);
}

export function ScoreSelector({ score, onSelect }: ScoreSelectorProps) {
  const wholeNumber = score === 0 ? 0 : Math.floor(score);
  const decimal = score === 0 ? 0 : Math.round((score - Math.floor(score)) * 10);

  function handleWholeSelect(value: number) {
    // If clicking the same whole number, keep decimal; otherwise reset to .0
    if (value === wholeNumber) {
      return;
    }
    onSelect(value);
  }

  function handleDecimalSelect(dec: number) {
    if (wholeNumber === 0) return;
    const newScore = wholeNumber + dec / 10;
    // Clamp to max 10
    onSelect(Math.min(newScore, 10));
  }

  return (
    <div className="space-y-2">
      {/* Whole number buttons */}
      <div className="grid grid-cols-5 gap-1 sm:flex">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
          <button
            key={value}
            type="button"
            className={`flex size-9 items-center justify-center rounded-md border text-sm font-medium transition-colors ${
              value === wholeNumber
                ? "border-amber-500 bg-amber-500/10 text-amber-500"
                : "border-border hover:bg-accent text-muted-foreground"
            }`}
            onClick={() => {
              handleWholeSelect(value);
            }}
          >
            {String(value)}
          </button>
        ))}
      </div>

      {/* Decimal refinement row */}
      {wholeNumber > 0 && (
        <div className="grid grid-cols-5 gap-1 sm:flex">
          {Array.from({ length: wholeNumber === 10 ? 1 : 10 }, (_, index) => index).map((dec) => (
            <button
              key={dec}
              type="button"
              className={`flex h-7 min-w-7 items-center justify-center rounded border text-xs font-medium transition-colors ${
                dec === decimal
                  ? "border-amber-500 bg-amber-500/10 text-amber-500"
                  : "border-border hover:bg-accent text-muted-foreground"
              }`}
              onClick={() => {
                handleDecimalSelect(dec);
              }}
            >
              .{String(dec)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SubmitRatingDialog({
  sessionId,
  mediaTitle,
  dateWatched,
  onRated,
  onBehalfOf,
}: SubmitRatingDialogProps) {
  const { submitRating, isSubmitting } = useSubmitRating();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [review, setReview] = useState("");

  function resetForm() {
    setScore(0);
    setReview("");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      resetForm();
    }
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (score === 0) {
      toast.error("Select a score from 1 to 10");
      return;
    }

    const success = await submitRating({
      sessionId,
      score,
      review: review.length > 0 ? review : undefined,
      userId: onBehalfOf?.id,
    });

    if (success) {
      toast.success("Rating submitted");
      setOpen(false);
      onRated();
    } else {
      toast.error("Failed to submit rating");
    }
  }

  const formattedDate = new Date(dateWatched).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {onBehalfOf === undefined ? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <StarIcon className="size-3.5" />
            Rate
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-5"
            title={`Rate for ${onBehalfOf.name}`}
          >
            <StarIcon className="size-3" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {onBehalfOf === undefined ? "Rate This Session" : `Rate for ${onBehalfOf.name}`}
          </DialogTitle>
          <DialogDescription>
            {mediaTitle} &middot; {formattedDate}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div className="space-y-2">
            <Label>Score</Label>
            <ScoreSelector score={score} onSelect={setScore} />
            <p className="text-muted-foreground text-xs">
              {score === 0 ? "Select a score from 1 to 10" : `${formatScore(score)} / 10`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rating-review">Review (optional)</Label>
            <Textarea
              id="rating-review"
              value={review}
              onChange={(event) => {
                setReview(event.target.value);
              }}
              placeholder="What did you think?"
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
            <Button type="submit" disabled={isSubmitting || score === 0}>
              {isSubmitting ? "Submitting..." : "Submit Rating"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
