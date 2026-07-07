"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOnlineUsers } from "@/hooks/use-online-users";

function getInitials(displayName: string | null, username: string): string {
  const name = displayName ?? username;
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const MAX_VISIBLE = 8;

export function OnlineUsersSection() {
  const { user } = useAuth();

  // Don't call presence hooks when Ably context isn't available (user not authenticated)
  if (user === null) {
    return null;
  }

  return <OnlineUsersList />;
}

function OnlineUsersList() {
  const onlineUsers = useOnlineUsers();

  if (onlineUsers.length === 0) return null;

  const visible = onlineUsers.slice(0, MAX_VISIBLE);
  const overflow = onlineUsers.length - MAX_VISIBLE;

  return (
    <div className="px-3 py-2">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
        Online
      </p>
      <div className="flex flex-col gap-0.5 py-0.5">
        {visible.map((user) => (
          <div
            key={user.userId}
            className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-[var(--fg-muted)]"
          >
            <span className="bg-cdb-tv size-1.5 shrink-0 rounded-full shadow-[0_0_0_3px_color-mix(in_oklch,var(--cdb-tv)_25%,transparent)]" />
            <Avatar className="size-5">
              <AvatarImage
                src={user.avatarUrl ?? undefined}
                alt={user.displayName ?? user.username}
              />
              <AvatarFallback className="text-[9px]">
                {getInitials(user.displayName, user.username)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{user.displayName ?? user.username}</span>
          </div>
        ))}
        {overflow > 0 && (
          <div className="px-2.5 py-1.5 text-xs text-[var(--fg-dim)]">+{overflow} more</div>
        )}
      </div>
    </div>
  );
}
