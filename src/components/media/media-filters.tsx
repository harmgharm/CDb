"use client";

import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all__";

export interface MediaFilterValues {
  search: string;
  type: string;
  sortBy: string;
  sortOrder: string;
}

interface MediaFiltersProps {
  readonly filters: MediaFilterValues;
  readonly onFilterChange: (filters: MediaFilterValues) => void;
}

export function MediaFilters({ filters, onFilterChange }: MediaFiltersProps) {
  function updateFilter(key: keyof MediaFilterValues, value: string) {
    onFilterChange({ ...filters, [key]: value });
  }

  function clearSearch() {
    onFilterChange({ ...filters, search: "" });
  }

  const hasActiveFilters =
    filters.search.length > 0 || filters.type.length > 0 || filters.sortBy !== "created_at";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search titles..."
          value={filters.search}
          onChange={(event) => {
            updateFilter("search", event.target.value);
          }}
          className="pr-9 pl-9"
        />
        {filters.search.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
            onClick={clearSearch}
          >
            <XIcon className="size-3" />
          </Button>
        )}
      </div>

      <Select
        value={filters.type.length > 0 ? filters.type : ALL_VALUE}
        onValueChange={(value) => {
          updateFilter("type", value === ALL_VALUE ? "" : value);
        }}
      >
        <SelectTrigger className="w-full sm:w-32">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All types</SelectItem>
          <SelectItem value="movie">Movies</SelectItem>
          <SelectItem value="tv">TV Shows</SelectItem>
          <SelectItem value="anime">Anime</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.sortBy}
        onValueChange={(value) => {
          updateFilter("sortBy", value);
        }}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at">Date added</SelectItem>
          <SelectItem value="date_watched">Date watched</SelectItem>
          <SelectItem value="title">Title</SelectItem>
          <SelectItem value="release_year">Release year</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.sortOrder}
        onValueChange={(value) => {
          updateFilter("sortOrder", value);
        }}
      >
        <SelectTrigger className="w-full sm:w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">Newest</SelectItem>
          <SelectItem value="asc">Oldest</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onFilterChange({
              search: "",
              type: "",
              sortBy: "created_at",
              sortOrder: "desc",
            });
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
