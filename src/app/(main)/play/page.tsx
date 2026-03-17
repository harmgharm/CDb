import { PlayPageContent } from "@/components/games/play-page-content";
import { requireAuth } from "@/lib/auth";

export default async function PlayPage() {
  await requireAuth();

  return <PlayPageContent />;
}
