import { supabase } from "./supabase";
import { DayRecord, WeightEntry } from "./types";

/**
 * The main store only keeps a rolling ~120-day window in memory (see
 * HISTORY_WINDOW_DAYS in store.tsx) so the app stays fast day-to-day. The
 * "Last 6 Months" report option (and any custom range further back) can
 * reach beyond that window, so the report generator asks Supabase directly
 * for whatever slice of history isn't already loaded, then merges it with
 * what's already in memory. If Supabase isn't configured (local/demo mode)
 * this simply returns nothing extra — the report falls back to whatever is
 * already in the store.
 */
export async function fetchDayRecordsForRange(
  userId: string,
  startISO: string,
  endISO: string
): Promise<{ days: DayRecord[]; weights: WeightEntry[] }> {
  if (!supabase) return { days: [], weights: [] };

  const [logsRes, waterRes, weightsRes] = await Promise.all([
    supabase.from("day_logs").select("*").eq("user_id", userId).gte("date", startISO).lte("date", endISO),
    supabase.from("daily_water").select("*").eq("user_id", userId).gte("date", startISO).lte("date", endISO),
    supabase.from("weight_entries").select("*").eq("user_id", userId).gte("date", startISO).lte("date", endISO),
  ]);

  const byDate = new Map<string, DayRecord>();
  function dayFor(date: string): DayRecord {
    let d = byDate.get(date);
    if (!d) {
      d = { date, logs: [], recentLogs: [], waterMl: 0 };
      byDate.set(date, d);
    }
    return d;
  }

  for (const log of logsRes.data ?? []) {
    dayFor(log.date).logs.push({ foodId: log.food_id, loggedQuantity: Number(log.logged_quantity) });
  }
  for (const w of waterRes.data ?? []) {
    dayFor(w.date).waterMl = Number(w.water_ml);
  }
  const weights: WeightEntry[] = (weightsRes.data ?? []).map((w) => ({
    date: w.date,
    weightKg: Number(w.weight_kg),
  }));
  for (const w of weights) {
    dayFor(w.date).weightKg = w.weightKg;
  }

  return { days: Array.from(byDate.values()), weights };
}
