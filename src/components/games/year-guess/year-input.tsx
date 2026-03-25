"use client";

/**
 * YearInput — Slider + number input for guessing a release year (1920–current year)
 */

import { SendIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

const MIN_YEAR = 1920;
const MAX_YEAR = new Date().getFullYear();
const STEP = 1;
const DEFAULT_YEAR = 2000;

interface YearInputProps {
  readonly onSubmit: (year: number) => void;
  readonly onValueChange?: (year: number) => void;
  readonly disabled?: boolean;
}

export function YearInput({ onSubmit, onValueChange, disabled = false }: YearInputProps) {
  const [year, setYear] = useState(DEFAULT_YEAR);

  const updateYear = useCallback(
    (value: number) => {
      const rounded = Math.round(value);
      setYear(rounded);
      onValueChange?.(rounded);
    },
    [onValueChange],
  );

  const handleSliderChange = useCallback(
    (values: number[]) => {
      const value = values[0];
      if (value !== undefined) {
        updateYear(value);
      }
    },
    [updateYear],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = Number.parseInt(event.target.value, 10);
      if (Number.isNaN(raw)) return;
      const clamped = Math.min(MAX_YEAR, Math.max(MIN_YEAR, raw));
      updateYear(clamped);
    },
    [updateYear],
  );

  const handleSubmit = useCallback(() => {
    if (!disabled) {
      onSubmit(year);
    }
  }, [disabled, onSubmit, year]);

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
      {/* Year display */}
      <div className="text-center">
        <span className="text-4xl font-bold tabular-nums">{String(year)}</span>
      </div>

      {/* Slider */}
      <div className="px-2">
        <Slider
          value={[year]}
          onValueChange={handleSliderChange}
          min={MIN_YEAR}
          max={MAX_YEAR}
          step={STEP}
          disabled={disabled}
        />
        {/* Scale markers */}
        <div className="text-muted-foreground mt-1 flex justify-between text-xs">
          <span>{String(MIN_YEAR)}</span>
          <span>1950</span>
          <span>1980</span>
          <span>2000</span>
          <span>{String(MAX_YEAR)}</span>
        </div>
      </div>

      {/* Number input + submit */}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={String(year)}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          min={MIN_YEAR}
          max={MAX_YEAR}
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
 * Default year value for auto-submit when time expires.
 */
export const DEFAULT_YEAR_VALUE = DEFAULT_YEAR;
