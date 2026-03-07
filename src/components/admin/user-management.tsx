"use client";

import { ShieldAlertIcon, ShieldCheckIcon, ShieldIcon, TrashIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminUsers, useChangeRole, useDeleteUser } from "@/hooks/use-admin";
import type { UserRole } from "@/lib/db/types";
import type { AdminUser } from "@/types/admin-responses";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(user: AdminUser): string {
  const name = user.display_name ?? user.username;
  return name.slice(0, 2).toUpperCase();
}

interface ConfirmDialogState {
  readonly type: "role" | "delete";
  readonly user: AdminUser;
  readonly newRole?: UserRole;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading, mutate } = useAdminUsers();
  const { changeRole, isUpdating } = useChangeRole();
  const { deleteUser, isDeleting } = useDeleteUser();
  const [confirm, setConfirm] = useState<ConfirmDialogState | null>(null);

  async function handleConfirm() {
    if (confirm === null) return;

    if (confirm.type === "role" && confirm.newRole !== undefined) {
      const success = await changeRole(confirm.user.id, confirm.newRole);
      if (success) {
        toast.success(`Changed ${confirm.user.username}'s role to ${confirm.newRole}`);
        await mutate();
      } else {
        toast.error("Failed to change role. You may be the last admin.");
      }
    }

    if (confirm.type === "delete") {
      const success = await deleteUser(confirm.user.id);
      if (success) {
        toast.success(`Deleted user ${confirm.user.username}`);
        await mutate();
      } else {
        toast.error("Failed to delete user.");
      }
    }

    setConfirm(null);
  }

  function handleRoleChange(user: AdminUser, newRole: UserRole) {
    if (newRole === user.role) return;
    setConfirm({ type: "role", user, newRole });
  }

  function handleDelete(user: AdminUser) {
    setConfirm({ type: "delete", user });
  }

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (users === undefined || users.length === 0) {
    return <div className="text-muted-foreground py-12 text-center text-sm">No users found.</div>;
  }

  const isSelf = (user: AdminUser): boolean => currentUser?.id === user.id;
  const dialogTitle = confirm?.type === "role" ? "Change User Role" : "Delete User";
  const dialogDescription =
    confirm?.type === "role"
      ? `Are you sure you want to change ${confirm.user.username}'s role to ${String(confirm.newRole)}?`
      : `Are you sure you want to permanently delete ${confirm?.user.username ?? "this user"}? This action cannot be undone.`;

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user, index) => (
              <motion.tr
                key={user.id}
                className="hover:bg-muted/50 border-b transition-colors"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.2 }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">{getInitials(user)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.display_name ?? user.username}</p>
                      <p className="text-muted-foreground text-xs">@{user.username}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(value: string) => {
                      handleRoleChange(user, value as UserRole);
                    }}
                    disabled={isSelf(user)}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <span className="flex items-center gap-1.5">
                          <ShieldAlertIcon className="size-3.5" />
                          Admin
                        </span>
                      </SelectItem>
                      <SelectItem value="moderator">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheckIcon className="size-3.5" />
                          Moderator
                        </span>
                      </SelectItem>
                      <SelectItem value="member">
                        <span className="flex items-center gap-1.5">
                          <ShieldIcon className="size-3.5" />
                          Member
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(user.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  {isSelf(user) ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      You
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        handleDelete(user);
                      }}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirm(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={confirm?.type === "delete" ? "destructive" : "default"}
              disabled={isUpdating || isDeleting}
              onClick={() => {
                void handleConfirm();
              }}
            >
              {isUpdating || isDeleting ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
