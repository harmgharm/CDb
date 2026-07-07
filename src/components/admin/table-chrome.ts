/**
 * Kit `.cdb-admin-table` chrome (elev-1 wrap, elev-2 uppercase micro headers,
 * 12x16 cells), applied from the consumers so the shadcn Table primitive stays
 * untouched. The arbitrary variants outrank the primitive's own th/td classes.
 */
export const ADMIN_TABLE_WRAP_CLASS = "overflow-hidden rounded-lg border bg-[var(--bg-elev-1)]";

export const ADMIN_TABLE_CLASS = [
  "[&_thead_th]:h-auto [&_thead_th]:bg-[var(--bg-elev-2)] [&_thead_th]:px-4 [&_thead_th]:py-[11px]",
  "[&_thead_th]:text-[11px] [&_thead_th]:font-semibold [&_thead_th]:tracking-[0.08em]",
  "[&_thead_th]:uppercase [&_thead_th]:whitespace-nowrap [&_thead_th]:text-[var(--fg-dim)]",
  "[&_tbody_td]:px-4 [&_tbody_td]:py-3",
  "[&_tbody_tr:last-child]:border-0",
].join(" ");
