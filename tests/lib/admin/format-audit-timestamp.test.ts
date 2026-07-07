import { describe, expect, it } from "vitest";

import { formatAuditTimestamp } from "@/lib/admin/format-audit-timestamp";

const NOW = new Date("2026-07-07T12:00:00");

describe("formatAuditTimestamp", () => {
  it("omits the year for current-year entries", () => {
    expect(formatAuditTimestamp("2026-06-11T20:42:00", NOW)).toBe("Jun 11 · 8:42 PM");
  });

  it("includes the year for older entries", () => {
    expect(formatAuditTimestamp("2025-06-11T20:42:00", NOW)).toBe("Jun 11, 2025 · 8:42 PM");
  });

  it("pads minutes and keeps 12-hour AM times", () => {
    expect(formatAuditTimestamp("2026-01-02T09:05:00", NOW)).toBe("Jan 2 · 9:05 AM");
  });

  it("handles midnight and noon", () => {
    expect(formatAuditTimestamp("2026-03-01T00:00:00", NOW)).toBe("Mar 1 · 12:00 AM");
    expect(formatAuditTimestamp("2026-03-01T12:00:00", NOW)).toBe("Mar 1 · 12:00 PM");
  });
});
