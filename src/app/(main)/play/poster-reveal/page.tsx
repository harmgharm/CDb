import { PlayPageContent } from "@/components/games/poster-reveal/play-page-content";
import { requireAuth } from "@/lib/auth";

export default async function PosterRevealPage() {
  await requireAuth();

  return <PlayPageContent />;
}
