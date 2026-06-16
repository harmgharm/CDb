/**
 * Issue line: a thin uppercase mono row with two end-anchored labels and a
 * flex-fill rule between them. Reads like a magazine masthead's dateline.
 *
 * Introduced on the Users roster (Phase 8) as "ROSTER · MAY MMXXVI ──── 3 online".
 * Presentational only; the page supplies the strings. Drop the `right` prop to
 * let the rule run to the trailing edge.
 */

interface IssueLineProps {
  /** Left-anchored label, e.g. "Roster · May MMXXVI". */
  readonly left: string;
  /** Right-anchored label, e.g. "3 online". Omit to run the rule to the edge. */
  readonly right?: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const ROMAN_UNITS: readonly [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function toRoman(year: number): string {
  let remaining = year;
  let out = "";
  for (const [value, numeral] of ROMAN_UNITS) {
    while (remaining >= value) {
      out += numeral;
      remaining -= value;
    }
  }
  return out;
}

/**
 * Format a date as a magazine dateline fragment, e.g. "May MMXXVI".
 * Exported so the roster can build "Roster · May MMXXVI" without duplicating
 * the Roman-numeral logic.
 */
export function formatIssueDate(date: Date): string {
  const month = MONTHS[date.getMonth()] ?? "";
  return `${month} ${toRoman(date.getFullYear())}`;
}

export function IssueLine({ left, right }: IssueLineProps) {
  return (
    <div className="text-muted-foreground flex items-center gap-3.5 py-3 font-mono text-[11px] tracking-[0.16em] uppercase">
      <span>{left}</span>
      <span className="bg-border h-px flex-1" aria-hidden="true" />
      {right !== undefined && <span>{right}</span>}
    </div>
  );
}
