"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { ApiResponse } from "@/lib/api/response";

import { FeatureGrid } from "./_landing/feature-grid";
import { HeroSection } from "./_landing/hero-section";
import { HeroSkeleton, TopRatedSkeleton } from "./_landing/hero-skeleton";
import { LandingFooter } from "./_landing/landing-footer";
import { RecentTicker } from "./_landing/recent-ticker";
import { TopRatedRow } from "./_landing/top-rated-row";
import type { PublicStats } from "./_landing/types";

export default function LandingPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuthAndFetchStats() {
      try {
        let meResponse = await fetch("/api/auth/me");
        if (meResponse.status === 401) {
          const refreshResponse = await fetch("/api/auth/refresh", { method: "POST" });
          if (refreshResponse.ok) {
            meResponse = await fetch("/api/auth/me");
          }
        }
        const meJson = (await meResponse.json()) as ApiResponse<unknown>;
        if (meJson.error === null) {
          router.replace("/home");
          return;
        }
      } catch {
        // Not logged in — continue showing landing page
      }

      try {
        const response = await fetch("/api/stats/public");
        const json = (await response.json()) as ApiResponse<PublicStats>;
        if (json.error === null) {
          setStats(json.data);
        }
      } catch {
        // Silently fail — page still works without stats
      } finally {
        setIsLoading(false);
      }
    }
    void checkAuthAndFetchStats();
  }, [router]);

  return (
    <main className="bg-background text-foreground min-h-screen">
      {isLoading || stats === null ? <HeroSkeleton /> : <HeroSection stats={stats} />}
      <FeatureGrid />
      {isLoading ? <TopRatedSkeleton /> : stats !== null && <TopRatedRow stats={stats} />}
      {stats !== null && <RecentTicker stats={stats} />}
      <LandingFooter />
    </main>
  );
}
