/**
 * Kit format is "Jun 11 · 8:42 PM" (no year); entries from earlier years add it
 * ("Jun 11, 2025 · 8:42 PM") so an old paper trail stays unambiguous.
 */
export function formatAuditTimestamp(dateString: string, now: Date = new Date()): string {
  const date = new Date(dateString);
  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}
