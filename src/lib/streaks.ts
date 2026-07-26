import { DayRecord, FoodTemplate, UserSettings } from "./types";
import { computeTotals, completionPercent } from "./nutrition";

/**
 * Streak tracking (Phase 3). Kept deliberately separate from weeklySummary's
 * 7-day "weekly streak" — these run over the full loaded history window so
 * they can back milestones like the 30-day streak, and are surfaced only on
 * the dedicated Progress tab (see StreaksAchievements.tsx) rather than
 * anywhere prominent, per the "keep streaks subtle" requirement.
 */

export interface StreakInfo {
  current: number;
  best: number;
}

export interface AllStreaks {
  calorie: StreakInfo;
  protein: StreakInfo;
  checklist: StreakInfo;
}

/** Whether a day's calorie total counts as "on target" for the goal mode. */
function hitCalorieGoal(calories: number, settings: UserSettings): boolean {
  if (calories <= 0 || settings.calorieGoal <= 0) return false;
  if (settings.goalMode === "gain") return calories >= settings.calorieGoal * 0.95;
  if (settings.goalMode === "lose") return calories <= settings.calorieGoal * 1.05;
  return calories >= settings.calorieGoal * 0.92 && calories <= settings.calorieGoal * 1.08; // maintain
}

function hitProteinGoal(protein: number, settings: UserSettings): boolean {
  if (settings.proteinGoal <= 0) return false;
  return protein >= settings.proteinGoal;
}

function hitChecklist(foods: FoodTemplate[], day: DayRecord): boolean {
  if (foods.filter((f) => !f.archived).length === 0) return false;
  return completionPercent(foods, day) >= 100;
}

function orderedDays(history: DayRecord[], today: DayRecord): DayRecord[] {
  const byDate = new Map<string, DayRecord>();
  for (const d of [...history, today]) byDate.set(d.date, d);
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * `best` = longest run of consecutive hit-days anywhere in the window.
 * `current` = the trailing run as of today, with a one-day grace period —
 * if today hasn't been hit yet (the day isn't over), we look at yesterday
 * instead of zeroing the streak out, matching common streak-app behavior.
 */
function computeStreak(days: DayRecord[], predicate: (d: DayRecord) => boolean): StreakInfo {
  let best = 0;
  let running = 0;
  for (const d of days) {
    if (predicate(d)) {
      running++;
      best = Math.max(best, running);
    } else {
      running = 0;
    }
  }

  let idx = days.length - 1;
  if (idx >= 0 && !predicate(days[idx])) idx--; // grace period for today
  let current = 0;
  for (; idx >= 0; idx--) {
    if (predicate(days[idx])) current++;
    else break;
  }

  return { current, best };
}

export function computeStreaks(
  foods: FoodTemplate[],
  history: DayRecord[],
  today: DayRecord,
  settings: UserSettings
): AllStreaks {
  const days = orderedDays(history, today);
  return {
    calorie: computeStreak(days, (d) => hitCalorieGoal(computeTotals(foods, d).calories, settings)),
    protein: computeStreak(days, (d) => hitProteinGoal(computeTotals(foods, d).protein, settings)),
    checklist: computeStreak(days, (d) => hitChecklist(foods, d)),
  };
}
