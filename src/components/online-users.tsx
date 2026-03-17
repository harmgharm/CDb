"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

const MAX_VISIBLE = 5;

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
      <p className="text-muted-foreground mb-2 text-xs font-medium">
        Online ({onlineUsers.length})
      </p>
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center -space-x-1.5">
          {visible.map((user) => (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar className="border-sidebar size-7 border-2">
                    <AvatarImage
                      src={user.avatarUrl ?? undefined}
                      alt={user.displayName ?? user.username}
                    />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(user.displayName, user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="border-sidebar absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 bg-emerald-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {user.displayName ?? user.username}
              </TooltipContent>
            </Tooltip>
          ))}
          {overflow > 0 && (
            <div className="bg-muted text-muted-foreground border-sidebar flex size-7 items-center justify-center rounded-full border-2 text-[10px] font-medium">
              +{overflow}
            </div>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}
