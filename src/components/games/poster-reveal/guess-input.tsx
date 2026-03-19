"use client";

/**
 * GuessInput — Autocomplete input for guessing media titles
 *
 * Filters a pre-loaded media list client-side. Supports:
 * - Selecting from dropdown (sends mediaId for exact match)
 * - Pressing Enter on typed text (sends text for fuzzy server-side match)
 *
 * Poster thumbnails are intentionally omitted to avoid revealing the answer.
 */

import { SearchIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { MediaListItem } from "@/types/media-responses";

interface GuessInputProps {
  readonly mediaOptions: MediaListItem[];
  readonly onGuess: (title: string, mediaId?: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
}

export function GuessInput({
  mediaOptions,
  onGuess,
  disabled = false,
  placeholder = "Type your guess...",
}: GuessInputProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    if (query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    return mediaOptions
      .filter((item) => item.title.toLowerCase().includes(lowerQuery))
      .slice(0, 10);
  }, [query, mediaOptions]);

  const handleSelect = useCallback(
    (item: MediaListItem) => {
      setQuery(item.title);
      setIsOpen(false);
      onGuess(item.title, item.id);
    },
    [onGuess],
  );

  const handleFreeTextSubmit = useCallback(() => {
    if (query.trim().length === 0) return;
    setIsOpen(false);
    onGuess(query.trim());
  }, [query, onGuess]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        // If dropdown is open and an item is highlighted, select it
        if (isOpen && filtered.length > 0) {
          const selected = filtered[selectedIndex];
          if (selected !== undefined) {
            handleSelect(selected);
            return;
          }
        }
        // Otherwise submit free text
        handleFreeTextSubmit();
        return;
      }

      if (!isOpen || filtered.length === 0) return;

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          setSelectedIndex((previous) => Math.min(previous + 1, filtered.length - 1));
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          setSelectedIndex((previous) => Math.max(previous - 1, 0));
          break;
        }
        // No default
      }
    },
    [isOpen, filtered, selectedIndex, handleSelect, handleFreeTextSubmit],
  );

  const handleChange = useCallback((event: React.SyntheticEvent<HTMLInputElement>) => {
    const value = (event.target as HTMLInputElement).value;
    setQuery(value);
    setIsOpen(value.length >= 2);
    setSelectedIndex(0);
  }, []);

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true);
          }}
          onBlur={() => {
            // Delay to allow click on dropdown item
            setTimeout(() => {
              setIsOpen(false);
            }, 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10"
          autoComplete="off"
          autoFocus
        />
      </div>

      {isOpen && filtered.length > 0 && (
        <ul
          className="bg-popover border-border absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-lg"
          role="listbox"
        >
          {filtered.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={index === selectedIndex}
              className={`cursor-pointer px-3 py-2 ${
                index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
              }`}
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelect(item);
              }}
              onMouseEnter={() => {
                setSelectedIndex(index);
              }}
            >
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="text-muted-foreground text-xs">
                {item.release_year === null ? "Unknown" : String(item.release_year)} ·{" "}
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {query.length >= 2 && filtered.length === 0 && isOpen && (
        <div className="bg-popover border-border absolute z-50 mt-1 w-full rounded-md border p-3 shadow-lg">
          <p className="text-muted-foreground text-sm">
            No matches found. Press Enter to submit as free text.
          </p>
        </div>
      )}
    </div>
  );
}
