"use client";

import { CalendarIcon, ShieldIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserList } from "@/hooks/use-users";
import type { UserListItem } from "@/types/user-responses";

function getInitials(displayName: string | null, username: string): string {
  const name = displayName ?? username;
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatJoinDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function UserCard({ user, index }: Readonly<{ user: UserListItem; index: number }>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
    >
      <Link href={`/users/${user.id}`}>
        <Card className="hover:border-primary/50 transition-colors">
          <CardContent className="flex items-center gap-4 p-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">
                {getInitials(user.display_name, user.username)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-medium">{user.display_name ?? user.username}</h3>
                {user.role === "admin" && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <ShieldIcon className="size-3" />
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">@{user.username}</p>
              <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                <CalendarIcon className="size-3" />
                Joined {formatJoinDate(user.created_at)}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function UserCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function UsersPage() {
  const { data: users, isLoading } = useUserList();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-1">
          {users === undefined
            ? "View group members and their stats."
            : `${String(users.length)} members in the group`}
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <UserCardSkeleton key={index} />
          ))}
        </div>
      )}

      {!isLoading && users?.length === 0 && (
        <p className="text-muted-foreground py-16 text-center">No users found.</p>
      )}

      {!isLoading && users !== undefined && users.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user, index) => (
            <UserCard key={user.id} user={user} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
