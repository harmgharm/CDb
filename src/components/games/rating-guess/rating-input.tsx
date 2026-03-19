"use client";

/**
 * RatingInput — Slider + number input for guessing a rating (0.0–10.0)
 */

import { SendIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

const MIN_RATING = 0;
const MAX_RATING = 10;
const STEP = 0.1;
const DEFAULT_RATING = 5;

interface RatingInputProps {
  readonly onSubmit: (rating: number) => void;
  readonly onValueChange?: (rating: number) => void;
  readonly disabled?: boolean;
}

export function RatingInput({ onSubmit, onValueChange, disabled = false }: RatingInputProps) {
  const [rating, setRating] = useState(DEFAULT_RATING);

  const updateRating = useCallback(
    (value: number) => {
      const rounded = Math.round(value * 10) / 10;
      setRating(rounded);
      onValueChange?.(rounded);
    },
    [onValueChange],
  );

  const handleSliderChange = useCallback(
    (values: number[]) => {
      const value = values[0];
      if (value !== undefined) {
        updateRating(value);
      }
    },
    [updateRating],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = Number.parseFloat(event.target.value);
      if (Number.isNaN(raw)) return;
      const clamped = Math.min(MAX_RATING, Math.max(MIN_RATING, raw));
      updateRating(clamped);
    },
    [updateRating],
  );

  const handleSubmit = useCallback(() => {
    if (!disabled) {
      onSubmit(rating);
    }
  }, [disabled, onSubmit, rating]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="w-full max-w-md space-y-4">
      {/* Rating display */}
      <div className="text-center">
        <span className="text-4xl font-bold tabular-nums">{rating.toFixed(1)}</span>
        <span className="text-muted-foreground ml-1 text-lg">/ 10</span>
      </div>

      {/* Slider */}
      <div className="px-2">
        <Slider
          value={[rating]}
          onValueChange={handleSliderChange}
          min={MIN_RATING}
          max={MAX_RATING}
          step={STEP}
          disabled={disabled}
        />
        {/* Scale markers */}
        <div className="text-muted-foreground mt-1 flex justify-between text-xs">
          <span>0</span>
          <span>2</span>
          <span>4</span>
          <span>6</span>
          <span>8</span>
          <span>10</span>
        </div>
      </div>

      {/* Number input + submit */}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={rating.toFixed(1)}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          min={MIN_RATING}
          max={MAX_RATING}
          step={STEP}
          disabled={disabled}
          className="w-24 text-center tabular-nums"
        />
        <Button onClick={handleSubmit} disabled={disabled} size="lg" className="flex-1">
          <SendIcon className="mr-2 size-4" />
          Submit Guess
        </Button>
      </div>
    </div>
  );
}

/**
 * Get the current rating from a RatingInput ref.
 * Used for auto-submit when time expires.
 */
export const DEFAULT_RATING_VALUE = DEFAULT_RATING;
