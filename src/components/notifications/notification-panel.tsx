"use client";

import { CheckCheckIcon, InboxIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkAllAsRead, useMarkAsRead, useNotifications } from "@/hooks/use-notifications";

import { NotificationItemRow } from "./notification-item";

interface NotificationPanelProps {
  readonly onClosePanel: () => void;
}

export function NotificationPanel({ onClosePanel }: NotificationPanelProps) {
  const { data, isLoading } = useNotifications(1, 15);
  const { markAsRead } = useMarkAsRead();
  const { markAllAsRead, isMarking } = useMarkAllAsRead();

  const hasUnread = data?.items.some((n) => !n.isRead) ?? false;

  function handleMarkAllRead() {
    void markAllAsRead();
  }

  function handleRead(id: string) {
    void markAsRead(id);
  }

  return (
    <div className="w-80">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-sm font-semibold">Notifications</p>
        {hasUnread && (
          <Button variant="ghost" size="xs" onClick={handleMarkAllRead} disabled={isMarking}>
            <CheckCheckIcon className="size-3" />
            Mark all read
          </Button>
        )}
      </div>
      <Separator />

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading && (
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

        {!isLoading && (data === undefined || data.items.length === 0) && (
          <div className="flex flex-col items-center gap-2 py-8">
            <InboxIcon className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">No notifications</p>
          </div>
        )}

        {!isLoading && data !== undefined && data.items.length > 0 && (
          <div className="py-1">
            {data.items.map((notification) => (
              <NotificationItemRow
                key={notification.id}
                notification={notification}
                onRead={handleRead}
                onClosePanel={onClosePanel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
