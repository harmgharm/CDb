/**
 * Shared presentational banners used by both multiplayer game variants.
 */

export function ScoreHeader({
  totalScore,
  baseScore,
  streakBonus,
}: Readonly<{ totalScore: number; baseScore?: number; streakBonus?: number }>) {
  return (
    <div className="text-center">
      <p className="text-muted-foreground text-xs tracking-wider uppercase">Score</p>
      <p className="text-3xl font-bold tabular-nums">{String(totalScore)}</p>
      {baseScore !== undefined && (
        <div className="text-muted-foreground flex items-center justify-center gap-3 text-sm">
          <span>Base: {String(baseScore)}</span>
          {streakBonus !== undefined && streakBonus > 0 && (
            <span className="text-orange-400">Streak: +{String(streakBonus)}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function SubmittedBanner({
  guessedRating,
  score,
}: Readonly<{ guessedRating: number; score: number }>) {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-6 py-3 text-center">
      <p className="font-medium text-blue-400">
        Submitted: {guessedRating.toFixed(1)} — +{String(score)} pts
      </p>
      <p className="text-muted-foreground mt-1 text-xs">Waiting for other players...</p>
    </div>
  );
}

export function CorrectGuessBanner({ score }: Readonly<{ score: number }>) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-center">
      <p className="font-medium text-emerald-500">Correct! +{String(score)} pts</p>
      <p className="text-muted-foreground mt-1 text-xs">Waiting for other players...</p>
    </div>
  );
}

export function WrongGuessBanner() {
  return (
    <div className="animate-shake rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-3 text-center">
      <p className="font-medium text-red-500">Wrong! Try again</p>
    </div>
  );
}
