"use client";

/**
 * InvitePlayersDialog — Select and invite users to a multiplayer game
 */

import { CheckCircle2Icon, Loader2Icon, SendIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInvitePlayers } from "@/hooks/use-games";
import { useUserList } from "@/hooks/use-users";
import type { GamePlayerResponse } from "@/types/game-responses";

interface InvitePlayersDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly gameId: string;
  readonly existingPlayers: GamePlayerResponse[];
}

function getInitials(displayName: string | null, username: string): string {
  const name = displayName ?? username;
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function InvitePlayersDialog({
  open,
  onOpenChange,
  gameId,
  existingPlayers,
}: InvitePlayersDialogProps) {
  const { user } = useAuth();
  const { data: users } = useUserList();
  const { invitePlayers, isInviting } = useInvitePlayers();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const existingIds = new Set(existingPlayers.map((p) => p.userId));
  const availableUsers = (users ?? []).filter((u) => u.id !== user?.id && !existingIds.has(u.id));

  const handleToggle = useCallback((userId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleInvite = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const count = await invitePlayers(gameId, ids);
    if (count !== null) {
      toast.success(`Invited ${String(count)} player${count === 1 ? "" : "s"}`);
      setInvitedIds((previous) => {
        const next = new Set(previous);
        for (const id of ids) {
          next.add(id);
        }
        return next;
      });
      setSelectedIds(new Set());
    }
  }, [gameId, invitePlayers, selectedIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite players</DialogTitle>
          <DialogDescription>Select friends to send a game invite notification.</DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-1 overflow-y-auto py-2">
          {availableUsers.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No users available to invite.
            </p>
          ) : (
            availableUsers.map((inviteUser) => {
              const isInvited = invitedIds.has(inviteUser.id);

              if (isInvited) {
                return (
                  <div
                    key={inviteUser.id}
                    className="flex items-center gap-3 rounded-lg p-2 opacity-60"
                  >
                    <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                    <Avatar className="size-7">
                      <AvatarImage
                        src={inviteUser.avatar_url ?? undefined}
                        alt={inviteUser.display_name ?? inviteUser.username}
                      />
                      <AvatarFallback className="text-[9px]">
                        {getInitials(inviteUser.display_name, inviteUser.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {inviteUser.display_name ?? inviteUser.username}
                      </p>
                      <p className="text-muted-foreground text-xs">@{inviteUser.username}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-500">
                      Invited
                    </Badge>
                  </div>
                );
              }

              return (
                <label
                  key={inviteUser.id}
                  className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-lg p-2"
                >
                  <Checkbox
                    checked={selectedIds.has(inviteUser.id)}
                    onCheckedChange={() => {
                      handleToggle(inviteUser.id);
                    }}
                  />
                  <Avatar className="size-7">
                    <AvatarImage
                      src={inviteUser.avatar_url ?? undefined}
                      alt={inviteUser.display_name ?? inviteUser.username}
                    />
                    <AvatarFallback className="text-[9px]">
                      {getInitials(inviteUser.display_name, inviteUser.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {inviteUser.display_name ?? inviteUser.username}
                    </p>
                    <p className="text-muted-foreground text-xs">@{inviteUser.username}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => {
              void handleInvite();
            }}
            disabled={selectedIds.size === 0 || isInviting}
          >
            {isInviting ? (
              <Loader2Icon className="mr-1.5 size-4 animate-spin" />
            ) : (
              <SendIcon className="mr-1.5 size-4" />
            )}
            <InviteButtonLabel isInviting={isInviting} count={selectedIds.size} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteButtonLabel({
  isInviting,
  count,
}: Readonly<{ isInviting: boolean; count: number }>) {
  if (isInviting) return "Sending...";
  return count > 0 ? `Invite ${String(count)}` : "Invite";
}
