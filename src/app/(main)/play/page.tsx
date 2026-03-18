import { GameHubContent } from "@/components/games/game-hub";
import { requireAuth } from "@/lib/auth";

export default async function PlayPage() {
  await requireAuth();

  return <GameHubContent />;
}
