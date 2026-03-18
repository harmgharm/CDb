import { PlayPageContent } from "@/components/games/play-page-content";
import { requireAuth } from "@/lib/auth";

export default async function PosterRevealPage() {
  await requireAuth();

  return <PlayPageContent />;
}
