"use client";

import { StarIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types/notification-responses";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${String(diffMinutes)}m ago`;
  if (diffHours < 24) return `${String(diffHours)}h ago`;
  if (diffDays < 7) return `${String(diffDays)}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const NOTIFICATION_ICONS: Record<string, typeof StarIcon> = {
  "session.rate_pending": StarIcon,
};

interface NotificationItemRowProps {
  readonly notification: NotificationItem;
  readonly onRead: (id: string) => void;
  readonly onClosePanel: () => void;
}

export function NotificationItemRow({
  notification,
  onRead,
  onClosePanel,
}: NotificationItemRowProps) {
  const Icon = NOTIFICATION_ICONS[notification.type] ?? StarIcon;

  function handleClick() {
    if (!notification.isRead) {
      onRead(notification.id);
    }
    onClosePanel();
  }

  const content = (
    <div
      className={cn(
        "hover:bg-accent flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors",
        !notification.isRead && "bg-accent/50",
      )}
    >
      <div className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-full">
        <Icon className="text-primary size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{notification.title}</p>
        <p className="text-muted-foreground line-clamp-2 text-xs">{notification.body}</p>
        <p className="text-muted-foreground mt-1 text-[11px]">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
      {!notification.isRead && <div className="bg-primary mt-2 size-2 shrink-0 rounded-full" />}
    </div>
  );

  if (notification.link !== null) {
    return (
      <Link href={notification.link} onClick={handleClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} className="w-full text-left">
      {content}
    </button>
  );
}
