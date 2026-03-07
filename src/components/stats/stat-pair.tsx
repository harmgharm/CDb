"use client";

interface StatPairProps {
  readonly children: React.ReactNode;
}

/**
 * Side-by-side layout for "Most X" / "Least X" or "Highest X" / "Lowest X" pairs.
 * Stacks to single column on mobile.
 */
export function StatPair({ children }: StatPairProps) {
  return <div className="grid gap-6 sm:grid-cols-2">{children}</div>;
}
