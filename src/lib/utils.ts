import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const IST_TIME_ZONE = "Asia/Kolkata";

/**
 * Today's calendar date (YYYY-MM-DD) in Indian Standard Time — the single
 * source of truth for "today" throughout the app.
 *
 * Do NOT use `new Date().toISOString()` for this. That returns the UTC
 * date, and since IST is UTC+5:30, any time between 00:00-05:29 IST is
 * still "yesterday" in UTC - silently rolling today back by a day.
 */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Adds `days` (negative to subtract) to an ISO date string and returns the
 * resulting ISO date string. Does the arithmetic entirely in UTC so it's
 * immune to the local-timezone round-trip bug: parsing "YYYY-MM-DDT00:00:00"
 * (no "Z") interprets it in the browser's/server's LOCAL timezone, and then
 * calling `.toISOString()` converts back to UTC - for any timezone ahead of
 * UTC (like IST) that silently shifts the date back by one day. Using
 * `Date.UTC` / `getUTC*` / `setUTC*` throughout means the calendar date
 * never gets reinterpreted through a timezone conversion.
 */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Adds `months` (negative to subtract) to an ISO date string. Same UTC-only approach as addDaysISO. */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}

/** Day of week (0=Sun..6=Sat) for an ISO date string, computed in UTC so it can't drift. */
export function dayOfWeekFromISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * How many days back "Log for a past day" allows picking, inclusive of
 * today (so 7 means today + 7 prior calendar days are selectable).
 */
export const MAX_BACKDATE_DAYS = 7;

/**
 * Clamps an ISO date into the allowed backdating window: [today - MAX_BACKDATE_DAYS, today].
 * Used any time a "log for" date comes from user input, so a stale UI or
 * bad value can never push a write outside the supported range.
 */
export function clampToBackdateWindow(iso: string): string {
  const max = todayISO();
  const min = addDaysISO(max, -MAX_BACKDATE_DAYS);
  if (iso > max) return max;
  if (iso < min) return min;
  return iso;
}

/**
 * Whether a food should appear in the checklist on a given calendar date.
 * A one-off food (`dateOnly` set) shows up ONLY on that exact date, no
 * matter what `activeDays` says. A recurring food (`dateOnly` null) shows
 * up on any date whose weekday is in `activeDays`. Use this everywhere
 * "is this food scheduled today" is asked, instead of checking
 * `activeDays` directly, so one-off vs recurring stays consistent.
 */
export function isFoodScheduledOn(
  food: { dateOnly?: string | null; activeDays: number[] },
  dateISO: string
): boolean {
  if (food.dateOnly) return food.dateOnly === dateISO;
  return food.activeDays.includes(dayOfWeekFromISO(dateISO));
}

export function formatDateLabel(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function formatDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
