import { PlayPageContent } from "@/components/games/year-guess/play-page-content";
import { requireAuth } from "@/lib/auth";

export default async function YearGuessPage() {
  await requireAuth();

  return <PlayPageContent />;
}
