import { DayRecord, FoodTemplate, UserSettings, WeightEntry } from "./types";
import { computeTotals, completionPercent } from "./nutrition";
import { weightTrendLabel } from "./goalCopy";
import { addDaysISO, round1, todayISO } from "./utils";

export interface WeeklySummary {
  avgCalories: number;
  avgProtein: number;
  daysGoalAchieved: number;
  daysTracked: number; // days in the window that have any logging at all
  consistencyScore: number; // 0-100, avg checklist completion across the week
  weeklyStreak: number; // consecutive days up to today meeting the calorie goal
  weightChangeKg: number | null;
  weightTrendLabel: string | null;
  headline: string;
}

function isoDaysAgo(n: number): string {
  return addDaysISO(todayISO(), -n);
}

/** Whether a day's calorie total counts as "on target" for the user's goal mode. */
function hitCalorieGoal(calories: number, settings: UserSettings): boolean {
  if (calories <= 0) return false;
  const goal = settings.calorieGoal;
  if (goal <= 0) return false;
  if (settings.goalMode === "gain") return calories >= goal * 0.95;
  if (settings.goalMode === "lose") return calories <= goal * 1.05;
  return calories >= goal * 0.92 && calories <= goal * 1.08; // maintain
}

function buildHeadline(daysGoalAchieved: number, daysTracked: number, consistencyScore: number): string {
  if (daysTracked === 0) return "No days logged yet this week — let's get your first one in.";
  if (daysGoalAchieved >= 6) return "Excellent week — you hit your goal almost every day.";
  if (daysGoalAchieved >= 4) return "Solid week — you're on track more often than not.";
  if (consistencyScore >= 50) return "A mixed week, but your checklist habit is holding steady.";
  return "A quieter week — small consistent steps will add up.";
}

export function computeWeeklySummary(
  foods: FoodTemplate[],
  history: DayRecord[],
  today: DayRecord,
  weights: WeightEntry[],
  settings: UserSettings
): WeeklySummary {
  const byDate = new Map<string, DayRecord>();
  for (const d of [...history, today]) byDate.set(d.date, d);

  const last7Dates = Array.from({ length: 7 }, (_, i) => isoDaysAgo(6 - i)); // oldest → today
  const days = last7Dates.map((date) => byDate.get(date) ?? { date, logs: [], recentLogs: [], waterMl: 0 });

  let sumCalories = 0;
  let sumProtein = 0;
  let sumCompletion = 0;
  let daysGoalAchieved = 0;
  let daysTracked = 0;

  for (const day of days) {
    const totals = computeTotals(foods, day);
    sumCalories += totals.calories;
    sumProtein += totals.protein;
    sumCompletion += completionPercent(foods, day);
    if (day.logs.length > 0) daysTracked++;
    if (hitCalorieGoal(totals.calories, settings)) daysGoalAchieved++;
  }

  let weeklyStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const totals = computeTotals(foods, days[i]);
    if (!hitCalorieGoal(totals.calories, settings)) break;
    weeklyStreak++;
  }

  const windowStart = last7Dates[0];
  const weekWeights = [...weights].filter((w) => w.date >= windowStart).sort((a, b) => a.date.localeCompare(b.date));
  let weightChangeKg: number | null = null;
  if (weekWeights.length >= 2) {
    weightChangeKg = round1(weekWeights[weekWeights.length - 1].weightKg - weekWeights[0].weightKg);
  }

  const consistencyScore = Math.round(sumCompletion / 7);

  return {
    avgCalories: Math.round(sumCalories / 7),
    avgProtein: Math.round(sumProtein / 7),
    daysGoalAchieved,
    daysTracked,
    consistencyScore,
    weeklyStreak,
    weightChangeKg,
    weightTrendLabel: weightChangeKg !== null ? weightTrendLabel(settings.goalMode, weightChangeKg) : null,
    headline: buildHeadline(daysGoalAchieved, daysTracked, consistencyScore),
  };
}
