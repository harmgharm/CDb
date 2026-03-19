import { PlayPageContent } from "@/components/games/rating-guess/play-page-content";
import { requireAuth } from "@/lib/auth";

export default async function RatingGuessPage() {
  await requireAuth();

  return <PlayPageContent />;
}
