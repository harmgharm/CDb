"use client";

import { CrownIcon, HeartIcon, UsersIcon } from "lucide-react";
import * as motion from "motion/react-client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-stats";

function displayName(name: string | null, username: string): string {
  return name ?? username;
}

function getInitials(name: string | null, username: string): string {
  const display = name ?? username;
  return display
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const CARD_VARIANTS = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (index: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: 0.5 + index * 0.15, duration: 0.4, ease: "easeOut" as const },
  }),
};

function GroupStatSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function GroupStats() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <GroupStatSkeleton key={index} />
        ))}
      </div>
    );
  }

  const items = [
    {
      title: "Top Picker",
      icon: <CrownIcon className="size-4 text-yellow-500" />,
      user: stats?.topPicker,
      stat: stats?.topPicker ? `${String(stats.topPicker.pickCount)} picks` : null,
    },
    {
      title: "Highest Rater",
      icon: <HeartIcon className="size-4 text-rose-500" />,
      user: stats?.topRater,
      stat: stats?.topRater ? `${String(stats.topRater.avgScore)} avg` : null,
    },
    {
      title: "Most Active",
      icon: <UsersIcon className="size-4 text-blue-500" />,
      user: stats?.topAttendee,
      stat: stats?.topAttendee ? `${String(stats.topAttendee.attendanceCount)} sessions` : null,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <motion.div
          key={item.title}
          variants={CARD_VARIANTS}
          initial="hidden"
          animate="visible"
          custom={index}
        >
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              {item.icon}
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {item.user !== null && item.user !== undefined ? (
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback>
                      {getInitials(item.user.displayName, item.user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm leading-none font-medium">
                      {displayName(item.user.displayName, item.user.username)}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">{item.stat}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Not enough data yet</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
