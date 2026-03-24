"use client";

import {
  CheckIcon,
  ClipboardIcon,
  KeyRoundIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldIcon,
  TrashIcon,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAdminUsers, useChangeRole, useDeleteUser, useResetPassword } from "@/hooks/use-admin";
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
  readonly type: "role" | "delete" | "reset-password";
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

function TemporaryPasswordDialog({
  username,
  generatedValue,
  onClose,
}: Readonly<{ username: string; generatedValue: string; onClose: () => void }>) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(generatedValue).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Password Reset Successful</DialogTitle>
          <DialogDescription>
            A temporary password has been generated for {username}. Share it with them securely —
            they should change it after logging in.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input value={generatedValue} readOnly className="font-mono" />
          <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopy}>
            {copied ? <CheckIcon className="size-4" /> : <ClipboardIcon className="size-4" />}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading, mutate } = useAdminUsers();
  const { changeRole, isUpdating } = useChangeRole();
  const { deleteUser, isDeleting } = useDeleteUser();
  const { resetPassword, isResetting } = useResetPassword();
  const [confirm, setConfirm] = useState<ConfirmDialogState | null>(null);
  const [resetResult, setResetResult] = useState<{
    username: string;
    generatedValue: string;
  } | null>(null);

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

    if (confirm.type === "reset-password") {
      const result = await resetPassword(confirm.user.id);
      if (result === null) {
        toast.error("Failed to reset password.");
      } else {
        setResetResult({ username: confirm.user.username, generatedValue: result });
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

  function handleResetPassword(user: AdminUser) {
    setConfirm({ type: "reset-password", user });
  }

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (users === undefined || users.length === 0) {
    return <div className="text-muted-foreground py-12 text-center text-sm">No users found.</div>;
  }

  const isSelf = (user: AdminUser): boolean => currentUser?.id === user.id;

  function getDialogContent(): { title: string; description: string } {
    const username = confirm?.user.username ?? "this user";
    switch (confirm?.type) {
      case "role": {
        return {
          title: "Change User Role",
          description: `Are you sure you want to change ${username}'s role to ${String(confirm.newRole)}?`,
        };
      }
      case "delete": {
        return {
          title: "Delete User",
          description: `Are you sure you want to permanently delete ${username}? This action cannot be undone.`,
        };
      }
      case "reset-password": {
        return {
          title: "Reset Password",
          description: `This will generate a new temporary password for ${username} and log them out of all sessions. Are you sure?`,
        };
      }
      default: {
        return { title: "", description: "" };
      }
    }
  }

  const { title: dialogTitle, description: dialogDescription } = getDialogContent();
  const isProcessing = isUpdating || isDeleting || isResetting;

  return (
    <>
      <TooltipProvider>
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
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                handleResetPassword(user);
                              }}
                            >
                              <KeyRoundIcon className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reset password</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
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
                          </TooltipTrigger>
                          <TooltipContent>Delete user</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>

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
              disabled={isProcessing}
              onClick={() => {
                void handleConfirm();
              }}
            >
              {isProcessing ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resetResult !== null && (
        <TemporaryPasswordDialog
          username={resetResult.username}
          generatedValue={resetResult.generatedValue}
          onClose={() => {
            setResetResult(null);
          }}
        />
      )}
    </>
  );
}
