/**
 * Shared presentational banners used by both multiplayer game variants.
 */

export function ScoreHeader({
  totalScore,
  baseScore,
  streakBonus,
  roundLabel,
}: Readonly<{
  totalScore: number;
  baseScore?: number;
  streakBonus?: number;
  roundLabel?: string;
}>) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="text-cdb-cherry-hi inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--cdb-cherry)_12%,transparent)] px-2.5 py-0.5 text-xs">
        <span className="bg-cdb-cherry-hi animate-up-next-pulse size-1.5 rounded-full" />
        Live{roundLabel === undefined ? "" : ` · ${roundLabel}`}
      </span>
      <div>
        <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
          Score
        </p>
        <p className="font-display text-[40px] leading-none">{String(totalScore)}</p>
      </div>
      {baseScore !== undefined && (
        <div className="text-muted-foreground flex items-center justify-center gap-3 text-sm">
          <span>Base: {String(baseScore)}</span>
          {streakBonus !== undefined && streakBonus > 0 && (
            <span className="text-cdb-warning">Streak: +{String(streakBonus)}</span>
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
    <div className="rounded-lg border border-[color-mix(in_oklch,var(--cdb-info)_30%,transparent)] bg-[color-mix(in_oklch,var(--cdb-info)_10%,transparent)] px-6 py-3 text-center">
      <p className="text-cdb-info font-medium">
        Submitted: {guessedRating.toFixed(1)} · +{String(score)} pts
      </p>
      <p className="text-muted-foreground mt-1 text-xs">Waiting for other players...</p>
    </div>
  );
}

export function CorrectGuessBanner({ score }: Readonly<{ score: number }>) {
  return (
    <div className="rounded-lg border border-[color-mix(in_oklch,var(--cdb-success)_30%,transparent)] bg-[color-mix(in_oklch,var(--cdb-success)_10%,transparent)] px-6 py-3 text-center">
      <p className="text-cdb-success font-medium">Correct! +{String(score)} pts</p>
      <p className="text-muted-foreground mt-1 text-xs">Waiting for other players...</p>
    </div>
  );
}

export function WrongGuessBanner() {
  return (
    <div className="animate-shake rounded-lg border border-[color-mix(in_oklch,var(--cdb-cherry)_30%,transparent)] bg-[color-mix(in_oklch,var(--cdb-cherry)_10%,transparent)] px-6 py-3 text-center">
      <p className="text-cdb-cherry-hi font-medium">Wrong! Try again</p>
    </div>
  );
}
