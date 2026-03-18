import { MultiplayerPageContent } from "@/components/games/multiplayer-page-content";
import { requireAuth } from "@/lib/auth";

export default async function MultiplayerGamePage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  await requireAuth();
  const { id } = await params;

  return <MultiplayerPageContent gameId={id} />;
}
