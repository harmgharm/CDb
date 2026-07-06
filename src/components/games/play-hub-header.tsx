/**
 * Play hub header — matches the kit's `PageHeader` shell (also used by the
 * Dashboard masthead): left-aligned serif title, muted subtitle, no icon, no
 * action slot.
 */

export function PlayHubHeader() {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[44px] leading-none font-normal tracking-[-0.015em]">
          Games
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Challenge yourself or compete with friends.
        </p>
      </div>
    </header>
  );
}
