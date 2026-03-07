"use client";

import {
  ArrowLeftIcon,
  CalendarIcon,
  ClapperboardIcon,
  CrownIcon,
  ShieldCheckIcon,
  ShieldIcon,
  StarIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RatingDistribution } from "@/components/users/rating-distribution";
import { RecentPicks } from "@/components/users/recent-picks";
import { UserDetailedStats } from "@/components/users/user-detailed-stats";
import { WatchlistSection } from "@/components/watchlist";
import { useUserProfile, useUserStats } from "@/hooks/use-users";

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
    month: "long",
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

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Skeleton className="h-8 w-20" />
      <div className="flex items-center gap-6">
        <Skeleton className="size-24 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
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
  const { data: stats, isLoading: statsLoading } = useUserStats(params.id);
  const isOwnProfile = currentUser?.id === params.id;

  if (profileLoading) {
    return <ProfileSkeleton />;
  }

  if (profile === undefined) {
    return (
      <div className="mx-auto max-w-5xl py-16 text-center">
        <p className="text-muted-foreground text-lg">User not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/users">Back to users</Link>
        </Button>
      </div>
    );
  }

  const statCards = [
    {
      title: "Sessions",
      value: String(profile.stats.sessionsAttended),
      icon: <ClapperboardIcon className="text-muted-foreground size-4" />,
    },
    {
      title: "Avg Rating",
      value: profile.stats.avgScore === null ? "—" : String(profile.stats.avgScore),
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
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back button */}
      <Button asChild variant="ghost" size="sm">
        <Link href="/users">
          <ArrowLeftIcon className="mr-1 size-4" />
          Back
        </Link>
      </Button>

      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" as const }}
        className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-6 sm:text-left"
      >
        <Avatar className="size-24">
          <AvatarImage
            src={profile.avatar_url ?? undefined}
            alt={profile.display_name ?? profile.username}
          />
          <AvatarFallback className="text-2xl">
            {getInitials(profile.display_name, profile.username)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start sm:gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {profile.display_name ?? profile.username}
            </h1>
            {profile.role === "admin" && (
              <Badge variant="secondary" className="gap-1">
                <ShieldIcon className="size-3" />
                Admin
              </Badge>
            )}
            {profile.role === "moderator" && (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheckIcon className="size-3" />
                Mod
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">@{profile.username}</p>
          <div className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
            <CalendarIcon className="size-3.5" />
            Member since {formatJoinDate(profile.created_at)}
          </div>
        </div>
      </motion.div>

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

      {/* Rating distribution (full width) */}
      {statsLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : (
        stats !== undefined &&
        stats.ratingDistribution.length > 0 && (
          <RatingDistribution distribution={stats.ratingDistribution} />
        )
      )}

      {/* Detailed stats (categorized sections) */}
      <UserDetailedStats userId={params.id} />

      {/* Recent picks */}
      {statsLoading ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : (
        stats !== undefined &&
        stats.recentPicks.length > 0 && <RecentPicks picks={stats.recentPicks} />
      )}

      {/* Watchlist */}
      <WatchlistSection userId={params.id} isOwnProfile={isOwnProfile} />
    </div>
  );
}
