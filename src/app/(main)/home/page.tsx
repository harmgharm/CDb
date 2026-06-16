import { ActivityFeed } from "./_components/activity-feed";
import { DashboardHeader } from "./_components/dashboard-header";
import { GroupDetailedStats } from "./_components/group-detailed-stats";
import { GroupStats } from "./_components/group-stats";
import { NowShowing } from "./_components/now-showing";
import { StatStrip } from "./_components/stat-strip";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <DashboardHeader />
      <NowShowing />
      <StatStrip />
      <GroupStats />
      <GroupDetailedStats />
      <ActivityFeed />
    </div>
  );
}
