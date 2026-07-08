"use client";

import { ArrowRightIcon, ShieldCheckIcon, ShieldIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";

import { formatIssueDate, IssueLine } from "@/components/editorial/issue-line";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnlineUsers } from "@/hooks/use-online-users";
import { useDashboardStats } from "@/hooks/use-stats";
import { useUserList } from "@/hooks/use-users";
import { buildRosterLede } from "@/lib/users/roster-lede";
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

function RosterStat({
  label,
  value,
  accent,
}: Readonly<{ label: string; value: string; accent?: boolean }>) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={`font-display text-2xl leading-none tracking-[-0.015em] tabular-nums ${
          accent === true ? "text-cdb-marquee" : ""
        }`}
      >
        {value}
      </span>
      <span className="font-mono text-[9px] tracking-[0.1em] text-[var(--fg-dim)] uppercase">
        {label}
      </span>
    </div>
  );
}

function RoleBadge({ role }: Readonly<{ role: UserListItem["role"] }>) {
  if (role === "admin") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
        <ShieldIcon className="size-3" />
        Admin
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
        <ShieldCheckIcon className="size-3" />
        Mod
      </span>
    );
  }
  return null;
}

function RosterRow({
  user,
  index,
  isOnline,
}: Readonly<{ user: UserListItem; index: number; isOnline: boolean }>) {
  const name = user.display_name ?? user.username;
  const tagline = user.tagline.trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
    >
      <Link
        href={`/users/${user.id}`}
        className="grid grid-cols-[28px_72px_1fr_auto] items-center gap-4 border-b border-[var(--border)] py-5 transition-[background,padding] hover:bg-[var(--bg-elev-2)] hover:px-3 sm:grid-cols-[32px_88px_1fr_auto_16px] sm:gap-6 sm:py-6"
      >
        <div className="font-mono text-xs tracking-[0.1em] text-[var(--fg-dim)]">
          {String(index + 1).padStart(2, "0")}
        </div>

        <div className="relative size-[72px] sm:size-22">
          <Avatar className="size-full">
            <AvatarImage src={user.avatar_url ?? undefined} alt={name} />
            <AvatarFallback className="text-lg">
              {getInitials(user.display_name, user.username)}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="bg-cdb-success border-background absolute right-1 bottom-1 size-3.5 rounded-full border-3 shadow-[0_0_0_3px_color-mix(in_oklch,var(--cdb-success)_25%,transparent)]" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-display truncate text-2xl leading-none tracking-[-0.02em] sm:text-3xl">
              {name}
            </span>
            <RoleBadge role={user.role} />
          </div>
          {tagline.length > 0 && (
            <span className="font-display text-cdb-marquee text-[15px] italic">{tagline}</span>
          )}
          <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--fg-dim)]">
            @{user.username} · joined {formatJoinDate(user.created_at)}
          </span>
          <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--fg-dim)] sm:hidden">
            {user.stats.picks} picks · {user.stats.watched} watched · Avg{" "}
            {user.stats.avgScore === null ? "—" : user.stats.avgScore.toFixed(1)}
          </span>
        </div>

        <div className="hidden items-center gap-6 sm:flex sm:gap-8">
          <RosterStat label="Picks" value={String(user.stats.picks)} />
          <RosterStat label="Watched" value={String(user.stats.watched)} />
          <RosterStat
            label="Avg"
            value={user.stats.avgScore === null ? "—" : user.stats.avgScore.toFixed(1)}
            accent
          />
        </div>

        <ArrowRightIcon className="hidden size-4 text-[var(--fg-dim)] sm:block" />
      </Link>
    </motion.div>
  );
}

function RosterRowSkeleton() {
  return (
    <div className="grid grid-cols-[28px_72px_1fr_auto] items-center gap-4 border-b border-[var(--border)] py-5 sm:grid-cols-[32px_88px_1fr_auto_16px] sm:gap-6 sm:py-6">
      <Skeleton className="h-4 w-5" />
      <Skeleton className="size-[72px] rounded-full sm:size-22" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-44 sm:hidden" />
      </div>
      <div className="hidden gap-6 sm:flex sm:gap-8">
        <Skeleton className="h-9 w-10" />
        <Skeleton className="h-9 w-12" />
        <Skeleton className="h-9 w-10" />
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const { data: users, isLoading } = useUserList();
  // The roster lede's "N weeks in" reads the same group-wide aggregate as the
  // Database masthead; null until the dashboard stats land (lede degrades).
  const { data: dashboardStats } = useDashboardStats();

  return (
    <div className="mx-auto max-w-5xl">
      <RosterContent
        users={users}
        isLoading={isLoading}
        authReady={user !== null}
        weeksActive={dashboardStats?.weeksSinceFirstSession ?? null}
      />
    </div>
  );
}

/**
 * Split out so the presence hook only runs once auth is confirmed — calling it
 * before the Ably context is ready (unauthenticated) throws. Mirrors the
 * OnlineUsersSection guard.
 */
function RosterContent({
  users,
  isLoading,
  authReady,
  weeksActive,
}: Readonly<{
  users: UserListItem[] | undefined;
  isLoading: boolean;
  authReady: boolean;
  weeksActive: number | null;
}>) {
  if (!authReady) {
    return (
      <RosterShell
        users={users}
        isLoading={isLoading}
        onlineIds={new Set()}
        weeksActive={weeksActive}
      />
    );
  }
  return <RosterWithPresence users={users} isLoading={isLoading} weeksActive={weeksActive} />;
}

function RosterWithPresence({
  users,
  isLoading,
  weeksActive,
}: Readonly<{
  users: UserListItem[] | undefined;
  isLoading: boolean;
  weeksActive: number | null;
}>) {
  const onlineUsers = useOnlineUsers();
  const onlineIds = new Set(onlineUsers.map((u) => u.userId));
  return (
    <RosterShell
      users={users}
      isLoading={isLoading}
      onlineIds={onlineIds}
      weeksActive={weeksActive}
    />
  );
}

function RosterShell({
  users,
  isLoading,
  onlineIds,
  weeksActive,
}: Readonly<{
  users: UserListItem[] | undefined;
  isLoading: boolean;
  onlineIds: Set<string>;
  weeksActive: number | null;
}>) {
  const memberCount = users?.length ?? 0;
  const onlineCount = users === undefined ? 0 : users.filter((u) => onlineIds.has(u.id)).length;
  const memberNoun = memberCount === 1 ? "member" : "members";
  const eyebrow =
    users === undefined ? "Ensemble cast" : `Ensemble cast · ${String(memberCount)} ${memberNoun}`;
  const lede = buildRosterLede({ memberCount, weeksActive });

  return (
    <>
      <header className="flex flex-col gap-2.5 border-b border-[var(--border-strong)] pt-4 pb-6">
        <span className="text-muted-foreground font-mono text-[11px] tracking-[0.16em] uppercase">
          {eyebrow}
        </span>
        <h1 className="font-display m-0 text-center text-[clamp(72px,11vw,144px)] leading-[0.88] font-normal tracking-[-0.045em]">
          The <em className="text-cdb-marquee tracking-[-0.06em] italic">cast</em>
        </h1>
        <p className="font-display text-muted-foreground mx-auto max-w-[560px] text-center text-lg leading-[1.4] italic">
          {lede}
        </p>
      </header>

      {/* Kit's .cdb-page-inner separates masthead and issue line with a 32px flex gap */}
      <div className="mt-8">
        <IssueLine
          left={`Roster · ${formatIssueDate(new Date())}`}
          right={onlineCount > 0 ? `${String(onlineCount)} online` : undefined}
        />
      </div>

      {isLoading && (
        <div className="flex flex-col">
          {Array.from({ length: 5 }, (_, index) => (
            <RosterRowSkeleton key={index} />
          ))}
        </div>
      )}

      {!isLoading && memberCount === 0 && (
        <p className="text-muted-foreground py-16 text-center">No one has joined the group yet.</p>
      )}

      {!isLoading && users !== undefined && memberCount > 0 && (
        <div className="flex flex-col">
          {users.map((user, index) => (
            <RosterRow key={user.id} user={user} index={index} isOnline={onlineIds.has(user.id)} />
          ))}
        </div>
      )}
    </>
  );
}
