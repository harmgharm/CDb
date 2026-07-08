"use client";

import {
  ArrowLeftIcon,
  BarChart3Icon,
  BookmarkIcon,
  ClapperboardIcon,
  CrownIcon,
  Gamepad2Icon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
  ShieldIcon,
  StarIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { notFound, useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import {
  MagazineCoverBackdrop,
  MagazineCoverHeader,
  OnlineNowPill,
} from "@/components/editorial/magazine-cover-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserGameStats } from "@/components/users/game-stats";
import { RatingDistribution } from "@/components/users/rating-distribution";
import { RecentPicks } from "@/components/users/recent-picks";
import { UserDetailedStats } from "@/components/users/user-detailed-stats";
import { WatchlistSection } from "@/components/watchlist";
import { useOnlineUsers } from "@/hooks/use-online-users";
import { useUserList, useUserProfile, useUserStats } from "@/hooks/use-users";
import { resolveDetailState } from "@/lib/api/detail-state";
import { type ProfileTab, resolveProfileTab } from "@/lib/users/profile-tabs";
import type { UserProfile } from "@/types/user-responses";

// Gold-active soft-chip tabs (kit's cdb-up-tab.active). Overrides the shadcn
// TabsTrigger's white-active bordered chip via className — same pattern as the
// For You tools card's TOOLS_TAB_CLASS. The dark: variants are needed to beat
// the primitive's own dark:data-[state=active]:* rules.
const PROFILE_TAB_CLASS = [
  "data-[state=active]:text-cdb-marquee-text dark:data-[state=active]:text-cdb-marquee-text",
  "data-[state=active]:border-transparent dark:data-[state=active]:border-transparent",
  "data-[state=active]:shadow-none",
  "h-8 gap-2 rounded-sm px-3.5 text-xs",
].join(" ");

// Kit's .cdb-up-tabs bar: 40px tall, 1px border, 8px radius, 2px gap (same
// chrome as the admin page's ADMIN_TABS_LIST_CLASS). The height must use the
// primitive's own variant prefix so tailwind-merge replaces its h-9.
const PROFILE_TABS_LIST_CLASS =
  "group-data-[orientation=horizontal]/tabs:h-10 gap-0.5 self-start rounded-md border";

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

interface StatCardProps {
  readonly title: string;
  readonly value: string;
  readonly icon: React.ReactNode;
  readonly index: number;
  /** Tints the value amber (the kit accents the Avg-rating tile). */
  readonly accent?: boolean;
}

/**
 * Kit's cdb-up-stat-card: an uppercase micro-label + quiet fg-dim icon in a head
 * row, then a large display-serif number below. The Avg-rating tile is tinted
 * amber via `accent`.
 */
function StatCard({ title, value, icon, index, accent = false }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1, duration: 0.3, ease: "easeOut" as const }}
    >
      <Card className="px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[var(--fg-muted)] uppercase">
            {title}
          </span>
          <span className="text-[var(--fg-dim)]">{icon}</span>
        </div>
        <div
          className={`font-display mt-1.5 text-[32px] leading-none tracking-[-0.02em] tabular-nums ${
            accent ? "text-cdb-marquee" : ""
          }`}
        >
          {value}
        </div>
      </Card>
    </motion.div>
  );
}

// Kit's cdb-up-role-badge: an amber pill (marquee tints) around the role.
const ROLE_PILL_CLASS =
  "text-cdb-marquee-text inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklch,var(--cdb-marquee)_32%,transparent)] bg-[color-mix(in_oklch,var(--cdb-marquee)_16%,transparent)] px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em]";

function ProfileRoleBadge({ role }: Readonly<{ role: UserProfile["role"] }>) {
  if (role === "admin") {
    return (
      <span className={ROLE_PILL_CLASS}>
        <ShieldIcon className="size-3" />
        Admin
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className={ROLE_PILL_CLASS}>
        <ShieldCheckIcon className="size-3" />
        Mod
      </span>
    );
  }
  return null;
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pt-8">
      <Skeleton className="h-8 w-24" />
      <div className="flex items-center gap-7">
        <Skeleton className="size-32 rounded-full" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-64" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const {
    data: profile,
    error: profileError,
    mutate: mutateProfile,
  } = useUserProfile(params.id) as {
    data: ReturnType<typeof useUserProfile>["data"];
    error: Error | undefined;
    mutate: ReturnType<typeof useUserProfile>["mutate"];
  };

  const detailState = resolveDetailState({
    hasData: profile !== undefined,
    error: profileError,
  });

  if (detailState === "loading") {
    return <ProfileSkeleton />;
  }

  if (detailState === "not-found") {
    // Confirmed-missing user (the API returned 404) — render the branded (main)
    // 404 inside the app shell (sidebar + AblyProvider stay mounted).
    notFound();
  }

  if (detailState === "error" || profile === undefined) {
    // A transient failure (500 / network), NOT a confirmed 404 — offer a retry
    // rather than wrongly claiming the profile doesn't exist. (`profile ===
    // undefined` is unreachable once state is "ready", but narrows the type.)
    return (
      <div className="mx-auto max-w-5xl py-16 text-center">
        <p className="text-muted-foreground text-lg">Couldn&apos;t load this profile.</p>
        <Button variant="outline" className="mt-4" onClick={() => void mutateProfile()}>
          Try again
        </Button>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  // ProfileView reads `?tab=` via useSearchParams, which must sit under a
  // Suspense boundary in the App Router (it opts the subtree into CSR).
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileView profile={profile} isOwnProfile={isOwnProfile} authReady={currentUser !== null} />
    </Suspense>
  );
}

/**
 * Gated presence pill. The live presence read must sit inside the Ably
 * ChannelProvider (only mounted once authenticated), so it lives in this small
 * leaf — swapping it on the auth transition never remounts the stateful
 * ProfileView around it. Renders nothing when offline or before auth resolves.
 */
function ProfilePresencePill({
  userId,
  authReady,
}: Readonly<{ userId: string; authReady: boolean }>) {
  if (!authReady) return null;
  return <PresencePillInner userId={userId} />;
}

function PresencePillInner({ userId }: Readonly<{ userId: string }>) {
  const onlineUsers = useOnlineUsers();
  const isOnline = onlineUsers.some((u) => u.userId === userId);
  return isOnline ? <OnlineNowPill /> : null;
}

function ProfileView({
  profile,
  isOwnProfile,
  authReady,
}: Readonly<{ profile: UserProfile; isOwnProfile: boolean; authReady: boolean }>) {
  const { data: stats, isLoading: statsLoading } = useUserStats(profile.id);
  // Roster position is decorative, so read the list from SWR cache without
  // triggering a fetch — it populates once the roster page has been visited.
  const { data: roster } = useUserList({ revalidateOnMount: false, revalidateIfStale: false });

  // The active tab is driven by the `?tab=` query param so a tab is deep-linkable
  // (e.g. the sidebar's watchlist fallback links to `?tab=watchlist`). Switching
  // a tab syncs the param back via `replace` so it stays shareable without
  // spamming browser history.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = resolveProfileTab(searchParams.get("tab"));

  const handleTabChange = (tab: string): void => {
    const params = new URLSearchParams(searchParams);
    if (tab === "overview") {
      // Keep the canonical profile URL clean — the default tab needs no param.
      params.delete("tab");
    } else {
      params.set("tab", tab as ProfileTab);
    }
    const query = params.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // Display-only roster position from the cached list. Null until it loads.
  const rosterIndex = roster?.findIndex((u) => u.id === profile.id) ?? -1;
  const rosterNumber = rosterIndex >= 0 ? rosterIndex + 1 : null;

  const name = profile.display_name ?? profile.username;

  const statCards = [
    {
      title: "Sessions",
      value: String(profile.stats.sessionsAttended),
      icon: <ClapperboardIcon className="size-3.5" />,
      accent: false,
    },
    {
      title: "Avg Rating",
      value: profile.stats.avgScore === null ? "—" : profile.stats.avgScore.toFixed(1),
      icon: <StarIcon className="size-3.5" />,
      accent: true,
    },
    {
      title: "Picks",
      value: String(profile.stats.pickCount),
      icon: <CrownIcon className="size-3.5" />,
      accent: false,
    },
    {
      title: "Ratings",
      value: String(profile.stats.ratingsGiven),
      icon: <StarIcon className="size-3.5" />,
      accent: false,
    },
  ];

  return (
    <div className="relative -mx-6 -mt-6 [overflow-x:clip]">
      <MagazineCoverBackdrop avatarUrl={profile.avatar_url} />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-6 pb-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/users">
            <ArrowLeftIcon className="mr-1 size-4" />
            Back to cast
          </Link>
        </Button>
      </div>

      <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-6 pb-6">
        <MagazineCoverHeader
          rosterNumber={rosterNumber}
          credit={`Member since ${formatJoinDate(profile.created_at)}`}
          name={name}
          tagline={profile.tagline}
          handle={`@${profile.username}`}
          metaItems={[
            `${String(profile.stats.pickCount)} picks`,
            `${String(profile.stats.sessionsAttended)} watched`,
          ]}
          avatarUrl={profile.avatar_url}
          avatarFallback={getInitials(profile.display_name, profile.username)}
          onlinePill={<ProfilePresencePill userId={profile.id} authReady={authReady} />}
          roleBadge={<ProfileRoleBadge role={profile.role} />}
        />

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card, index) => (
            <StatCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              index={index}
              accent={card.accent}
            />
          ))}
        </div>

        {/* Tabbed content — active tab mirrors the `?tab=` query param. */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Kit's cdb-up-tabs hugs its content, left-aligned. The list is w-fit
              but the Tabs root is a flex column that stretches it — self-start
              (the kit's align-self: flex-start) stops the stretch. */}
          <TabsList className={PROFILE_TABS_LIST_CLASS}>
            <TabsTrigger value="overview" className={PROFILE_TAB_CLASS}>
              <LayoutDashboardIcon className="size-[13px]" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className={PROFILE_TAB_CLASS}>
              <BarChart3Icon className="size-[13px]" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="games" className={PROFILE_TAB_CLASS}>
              <Gamepad2Icon className="size-[13px]" />
              <span className="hidden sm:inline">Games</span>
            </TabsTrigger>
            <TabsTrigger value="watchlist" className={PROFILE_TAB_CLASS}>
              <BookmarkIcon className="size-[13px]" />
              <span className="hidden sm:inline">Watchlist</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Rating distribution */}
            {statsLoading ? (
              <Skeleton className="h-64 rounded-lg" />
            ) : (
              stats !== undefined &&
              stats.ratingDistribution.length > 0 && (
                <RatingDistribution
                  distribution={stats.ratingDistribution}
                  avgScore={profile.stats.avgScore}
                />
              )
            )}

            {/* Recent picks */}
            {statsLoading ? (
              <Skeleton className="h-48 rounded-lg" />
            ) : (
              stats !== undefined &&
              stats.recentPicks.length > 0 && <RecentPicks picks={stats.recentPicks} />
            )}
          </TabsContent>

          <TabsContent value="stats">
            <UserDetailedStats userId={profile.id} />
          </TabsContent>

          <TabsContent value="games">
            <UserGameStats userId={profile.id} />
          </TabsContent>

          <TabsContent value="watchlist">
            <WatchlistSection userId={profile.id} isOwnProfile={isOwnProfile} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
