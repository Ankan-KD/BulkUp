import { formatDateShort, todayISO } from "./utils";

/**
 * Health & Nutrition Report — period selection.
 * Kept separate from reportData.ts so the date-math is easy to unit-reason
 * about on its own (no dependency on foods/history/etc).
 */

export type ReportPeriodKey =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "last3m"
  | "last6m"
  | "custom";

export const REPORT_PERIOD_OPTIONS: { key: ReportPeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "last3m", label: "Last 3 Months" },
  { key: "last6m", label: "Last 6 Months" },
  { key: "custom", label: "Custom Date Range" },
];

export interface ReportPeriod {
  key: ReportPeriodKey;
  label: string;
  startISO: string; // inclusive
  endISO: string; // inclusive
}

function isoFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayAsDate(): Date {
  return new Date(todayISO() + "T00:00:00");
}

/** Resolves a period key (+ optional custom bounds) into concrete ISO dates. */
export function resolvePeriod(
  key: ReportPeriodKey,
  customStartISO?: string,
  customEndISO?: string
): ReportPeriod {
  const today = todayAsDate();

  if (key === "today") {
    const iso = isoFromDate(today);
    return { key, label: "Today", startISO: iso, endISO: iso };
  }
  if (key === "yesterday") {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    const iso = isoFromDate(d);
    return { key, label: "Yesterday", startISO: iso, endISO: iso };
  }
  if (key === "last7") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { key, label: "Last 7 Days", startISO: isoFromDate(start), endISO: isoFromDate(today) };
  }
  if (key === "last30") {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { key, label: "Last 30 Days", startISO: isoFromDate(start), endISO: isoFromDate(today) };
  }
  if (key === "last3m") {
    const start = new Date(today);
    start.setMonth(start.getMonth() - 3);
    start.setDate(start.getDate() + 1);
    return { key, label: "Last 3 Months", startISO: isoFromDate(start), endISO: isoFromDate(today) };
  }
  if (key === "last6m") {
    const start = new Date(today);
    start.setMonth(start.getMonth() - 6);
    start.setDate(start.getDate() + 1);
    return { key, label: "Last 6 Months", startISO: isoFromDate(start), endISO: isoFromDate(today) };
  }
  // custom
  const start = customStartISO && customStartISO <= (customEndISO ?? customStartISO) ? customStartISO : customEndISO ?? isoFromDate(today);
  const end = customEndISO ?? customStartISO ?? isoFromDate(today);
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  return { key, label: "Custom Range", startISO: lo, endISO: hi };
}

/** All ISO dates from start to end inclusive, chronological order. */
export function datesInRange(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const cur = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  // Safety cap so a malformed range can never hang the browser.
  let guard = 0;
  while (cur.getTime() <= end.getTime() && guard < 5000) {
    out.push(isoFromDate(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out;
}

export function periodRangeLabel(period: ReportPeriod): string {
  if (period.startISO === period.endISO) return formatDateShort(period.startISO);
  return `${formatDateShort(period.startISO)} – ${formatDateShort(period.endISO)}`;
}
