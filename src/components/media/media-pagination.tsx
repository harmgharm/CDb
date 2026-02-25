"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MediaPaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
}

export function MediaPagination({ page, totalPages, onPageChange }: MediaPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => {
          onPageChange(page - 1);
        }}
      >
        <ChevronLeftIcon className="size-4" />
        Previous
      </Button>
      <span className="text-muted-foreground text-sm">
        Page {String(page)} of {String(totalPages)}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => {
          onPageChange(page + 1);
        }}
      >
        Next
        <ChevronRightIcon className="size-4" />
      </Button>
    </div>
  );
}
