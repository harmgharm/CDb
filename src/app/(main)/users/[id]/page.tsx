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
import { useParams } from "next/navigation";

import {
  MagazineCoverBackdrop,
  MagazineCoverHeader,
  OnlineNowPill,
} from "@/components/editorial/magazine-cover-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserGameStats } from "@/components/users/game-stats";
import { RatingDistribution } from "@/components/users/rating-distribution";
import { RecentPicks } from "@/components/users/recent-picks";
import { UserDetailedStats } from "@/components/users/user-detailed-stats";
import { WatchlistSection } from "@/components/watchlist";
import { useOnlineUsers } from "@/hooks/use-online-users";
import { useUserList, useUserProfile, useUserStats } from "@/hooks/use-users";
import type { UserProfile } from "@/types/user-responses";

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
}

function StatCard({ title, value, icon, index }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1, duration: 0.3, ease: "easeOut" as const }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ProfileRoleBadge({ role }: Readonly<{ role: UserProfile["role"] }>) {
  if (role === "admin") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <ShieldIcon className="size-3" />
        Admin
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
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
  const { data: profile, isLoading: profileLoading } = useUserProfile(params.id);

  if (profileLoading) {
    return <ProfileSkeleton />;
  }

  if (profile === undefined) {
    return (
      <div className="mx-auto max-w-5xl py-16 text-center">
        <p className="text-muted-foreground text-lg">We couldn&apos;t find that profile.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/users">Back to cast</Link>
        </Button>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;

  return (
    <ProfileView profile={profile} isOwnProfile={isOwnProfile} authReady={currentUser !== null} />
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

  // Display-only roster position from the cached list. Null until it loads.
  const rosterIndex = roster?.findIndex((u) => u.id === profile.id) ?? -1;
  const rosterNumber = rosterIndex >= 0 ? rosterIndex + 1 : null;

  const name = profile.display_name ?? profile.username;

  const statCards = [
    {
      title: "Sessions",
      value: String(profile.stats.sessionsAttended),
      icon: <ClapperboardIcon className="text-muted-foreground size-4" />,
    },
    {
      title: "Avg Rating",
      value: profile.stats.avgScore === null ? "—" : profile.stats.avgScore.toFixed(1),
      icon: <StarIcon className="text-muted-foreground size-4" />,
    },
    {
      title: "Picks",
      value: String(profile.stats.pickCount),
      icon: <CrownIcon className="text-muted-foreground size-4" />,
    },
    {
      title: "Ratings",
      value: String(profile.stats.ratingsGiven),
      icon: <StarIcon className="text-muted-foreground size-4" />,
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
            />
          ))}
        </div>

        {/* Tabbed content */}
        <Tabs defaultValue="overview">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview">
              <LayoutDashboardIcon className="size-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3Icon className="size-4" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="games">
              <Gamepad2Icon className="size-4" />
              <span className="hidden sm:inline">Games</span>
            </TabsTrigger>
            <TabsTrigger value="watchlist">
              <BookmarkIcon className="size-4" />
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
