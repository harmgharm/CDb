"use client";

import { CheckCheckIcon, InboxIcon, Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useClearAllNotifications,
  useDeleteNotification,
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
} from "@/hooks/use-notifications";
import type { NotificationItem } from "@/types/notification-responses";

import { NotificationItemRow } from "./notification-item";

const PAGE_SIZE = 15;

interface NotificationPanelProps {
  readonly onClosePanel: () => void;
}

/**
 * Merge new items into an existing list, deduplicating by id.
 */
function mergeItems(
  existing: readonly NotificationItem[],
  incoming: readonly NotificationItem[],
): NotificationItem[] {
  const existingIds = new Set(existing.map((item) => item.id));
  const newItems = incoming.filter((item) => !existingIds.has(item.id));
  return [...existing, ...newItems];
}

export function NotificationPanel({ onClosePanel }: NotificationPanelProps) {
  const [currentPage, setCurrentPage] = useState(1);
  // Items from pages 1..N-1, stored when user clicks "Load more"
  const [previousItems, setPreviousItems] = useState<NotificationItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [isCleared, setIsCleared] = useState(false);

  const { data, isLoading } = useNotifications(currentPage, PAGE_SIZE);
  const { markAsRead } = useMarkAsRead();
  const { markAllAsRead, isMarking } = useMarkAllAsRead();
  const { deleteNotification } = useDeleteNotification();
  const { clearAll, isClearing } = useClearAllNotifications();

  // Build display list: previous pages + current page, minus deleted
  const currentItems = data?.items ?? [];
  const allItems = isCleared
    ? []
    : mergeItems(previousItems, currentItems).filter((item) => !deletedIds.has(item.id));

  const hasUnread = allItems.some((n) => !n.isRead);
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const hasMore = currentPage < totalPages;

  function handleMarkAllRead() {
    void markAllAsRead();
  }

  function handleRead(id: string) {
    void markAsRead(id);
  }

  const handleDelete = useCallback(
    (id: string) => {
      setDeletedIds((previous) => new Set([...previous, id]));
      void deleteNotification(id);
    },
    [deleteNotification],
  );

  function handleClearAll() {
    setIsCleared(true);
    setPreviousItems([]);
    setCurrentPage(1);
    void clearAll();
  }

  function handleLoadMore() {
    // Snapshot current display into previousItems before advancing
    setPreviousItems(allItems);
    setCurrentPage((previous) => previous + 1);
  }

  return (
    <div className="w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-sm font-semibold">Notifications</p>
        <div className="flex items-center gap-1">
          {hasUnread && (
            <Button variant="ghost" size="xs" onClick={handleMarkAllRead} disabled={isMarking}>
              <CheckCheckIcon className="size-3" />
              Mark all read
            </Button>
          )}
          {allItems.length > 0 && (
            <Button variant="ghost" size="xs" onClick={handleClearAll} disabled={isClearing}>
              <Trash2Icon className="size-3" />
              Clear all
            </Button>
          )}
        </div>
      </div>
      <Separator />

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading && currentPage === 1 && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && allItems.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <InboxIcon className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">No notifications</p>
          </div>
        )}

        {allItems.length > 0 && (
          <div className="py-1">
            {allItems.map((notification) => (
              <NotificationItemRow
                key={notification.id}
                notification={notification}
                onRead={handleRead}
                onDelete={handleDelete}
                onClosePanel={onClosePanel}
              />
            ))}
          </div>
        )}

        {/* Load more + count */}
        {allItems.length > 0 && (
          <div className="border-t px-3 py-2">
            <p className="text-muted-foreground mb-1 text-center text-[11px]">
              Showing {allItems.length} of {total}
            </p>
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? "Loading..." : "Load more"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
