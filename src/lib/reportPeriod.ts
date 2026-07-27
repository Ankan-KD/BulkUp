import { addDaysISO, addMonthsISO, formatDateShort, todayISO } from "./utils";

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

/** Resolves a period key (+ optional custom bounds) into concrete ISO dates. */
export function resolvePeriod(
  key: ReportPeriodKey,
  customStartISO?: string,
  customEndISO?: string
): ReportPeriod {
  const today = todayISO(); // IST calendar date, e.g. "2026-07-28"

  if (key === "today") {
    return { key, label: "Today", startISO: today, endISO: today };
  }
  if (key === "yesterday") {
    const iso = addDaysISO(today, -1);
    return { key, label: "Yesterday", startISO: iso, endISO: iso };
  }
  if (key === "last7") {
    return { key, label: "Last 7 Days", startISO: addDaysISO(today, -6), endISO: today };
  }
  if (key === "last30") {
    return { key, label: "Last 30 Days", startISO: addDaysISO(today, -29), endISO: today };
  }
  if (key === "last3m") {
    return { key, label: "Last 3 Months", startISO: addDaysISO(addMonthsISO(today, -3), 1), endISO: today };
  }
  if (key === "last6m") {
    return { key, label: "Last 6 Months", startISO: addDaysISO(addMonthsISO(today, -6), 1), endISO: today };
  }
  // custom
  const start = customStartISO && customStartISO <= (customEndISO ?? customStartISO) ? customStartISO : customEndISO ?? today;
  const end = customEndISO ?? customStartISO ?? today;
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  return { key, label: "Custom Range", startISO: lo, endISO: hi };
}

/** All ISO dates from start to end inclusive, chronological order. */
export function datesInRange(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  let cur = startISO;
  // Safety cap so a malformed range can never hang the browser.
  let guard = 0;
  while (cur <= endISO && guard < 5000) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
    guard++;
  }
  return out;
}

export function periodRangeLabel(period: ReportPeriod): string {
  if (period.startISO === period.endISO) return formatDateShort(period.startISO);
  return `${formatDateShort(period.startISO)} – ${formatDateShort(period.endISO)}`;
}
