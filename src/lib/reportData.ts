import { DayRecord, FoodTemplate, MilestoneKey, MilestoneRecord, UserSettings, WeightEntry } from "./types";
import { computeTotals, completionPercent } from "./nutrition";
import { milestoneCopy } from "./milestones";
import { round1 } from "./utils";
import { datesInRange, ReportPeriod } from "./reportPeriod";

/** Mirrors the goal-hit logic in streaks.ts / weeklySummary.ts (kept as its
 * own small copy here, matching how those two files already each keep
 * their own copy rather than sharing one). */
function hitCalorieGoal(calories: number, settings: UserSettings): boolean {
  if (calories <= 0 || settings.calorieGoal <= 0) return false;
  if (settings.goalMode === "gain") return calories >= settings.calorieGoal * 0.95;
  if (settings.goalMode === "lose") return calories <= settings.calorieGoal * 1.05;
  return calories >= settings.calorieGoal * 0.92 && calories <= settings.calorieGoal * 1.08;
}

function hitProteinGoal(protein: number, settings: UserSettings): boolean {
  return settings.proteinGoal > 0 && protein >= settings.proteinGoal;
}

function hitWaterGoal(waterMl: number, settings: UserSettings): boolean {
  return settings.waterGoalMl > 0 && waterMl >= settings.waterGoalMl;
}

export interface ReportDayRow {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  waterMl: number;
  weightKg: number | null;
  calorieGoalMet: boolean;
  proteinGoalMet: boolean;
  waterGoalMet: boolean;
  checklistPct: number;
  hasData: boolean;
}

export interface ReportFoodItem {
  loggedName: string;
  quantity: number;
}

export interface ReportDayDetail extends ReportDayRow {
  items: { name: string; emoji: string; quantity: number; unit: string; calories: number }[];
}

export interface FoodFrequency {
  foodId: string;
  name: string;
  emoji: string;
  daysLogged: number;
  totalQuantity: number;
  unit: string;
  totalCalories: number;
}

export interface ReportAchievement {
  key: MilestoneKey;
  title: string;
  description: string;
  achievedAt: string;
}

export interface ReportData {
  period: ReportPeriod;
  userName: string;
  userEmail: string;
  settings: UserSettings;
  days: ReportDayRow[];
  dayDetails: ReportDayDetail[];
  summary: {
    daysIncluded: number;
    daysTracked: number;
    avgCalories: number;
    avgProtein: number;
    avgCarbs: number;
    avgFats: number;
    avgWaterMl: number;
    consistencyScore: number;
    daysGoalAchieved: number;
    currentWeightKg: number | null;
    goalWeightKg: number;
  };
  weight: {
    series: { date: string; weightKg: number }[];
    startWeightKg: number | null;
    endWeightKg: number | null;
    changeKg: number | null;
    weeklyAvgChangeKg: number | null;
  };
  nutrition: {
    highestCalories: number;
    lowestCalories: number;
    avgCalories: number;
    highestProtein: number;
    avgProtein: number;
  };
  water: {
    goalMl: number;
    avgMl: number;
    bestDay: { date: string; waterMl: number } | null;
    completionPct: number;
  };
  foods: FoodFrequency[];
  goalAchievement: {
    calorieDays: number;
    proteinDays: number;
    waterDays: number;
    totalDays: number;
    checklistCompletionPct: number;
  };
  achievements: ReportAchievement[];
}

export function buildReportData(params: {
  period: ReportPeriod;
  foods: FoodTemplate[];
  allDays: DayRecord[]; // history + today + any backfilled days, deduped by caller
  weights: WeightEntry[];
  milestones: MilestoneRecord[];
  settings: UserSettings;
  userName: string;
  userEmail: string;
}): ReportData {
  const { period, foods, allDays, weights, milestones, settings, userName, userEmail } = params;

  const byDate = new Map<string, DayRecord>();
  for (const d of allDays) byDate.set(d.date, d);

  const dateList = datesInRange(period.startISO, period.endISO);

  const days: ReportDayRow[] = [];
  const dayDetails: ReportDayDetail[] = [];

  for (const date of dateList) {
    const record: DayRecord = byDate.get(date) ?? { date, logs: [], recentLogs: [], waterMl: 0 };
    const totals = computeTotals(foods, record);
    const hasData = record.logs.length > 0 || record.weightKg !== undefined || record.waterMl > 0;

    const row: ReportDayRow = {
      date,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fats: totals.fats,
      waterMl: record.waterMl,
      weightKg: record.weightKg ?? null,
      calorieGoalMet: hitCalorieGoal(totals.calories, settings),
      proteinGoalMet: hitProteinGoal(totals.protein, settings),
      waterGoalMet: hitWaterGoal(record.waterMl, settings),
      checklistPct: completionPercent(foods, record),
      hasData,
    };
    days.push(row);

    const items = record.logs
      .filter((l) => l.loggedQuantity > 0)
      .map((l) => {
        const food = foods.find((f) => f.id === l.foodId);
        if (!food) return null;
        const mult =
          food.kind === "binary" || food.unit === "serving"
            ? l.loggedQuantity / Math.max(1, food.targetQuantity)
            : l.loggedQuantity;
        return {
          name: food.name,
          emoji: food.emoji,
          quantity: l.loggedQuantity,
          unit: food.unit,
          calories: Math.round(food.calories * mult),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    dayDetails.push({ ...row, items });
  }

  const trackedDays = days.filter((d) => d.hasData);
  const n = Math.max(1, days.length);

  const sumCalories = days.reduce((a, d) => a + d.calories, 0);
  const sumProtein = days.reduce((a, d) => a + d.protein, 0);
  const sumCarbs = days.reduce((a, d) => a + d.carbs, 0);
  const sumFats = days.reduce((a, d) => a + d.fats, 0);
  const sumWater = days.reduce((a, d) => a + d.waterMl, 0);
  const sumChecklist = days.reduce((a, d) => a + d.checklistPct, 0);

  const daysGoalAchieved = days.filter((d) => d.calorieGoalMet).length;

  // Weight series: any day in range with a logged weight.
  const weightSeries = days
    .filter((d) => d.weightKg !== null)
    .map((d) => ({ date: d.date, weightKg: d.weightKg as number }));

  // Fall back to the most recent weight entry at/before the period start
  // for "start weight" if nothing was logged on day 1 itself.
  const priorWeight = [...weights]
    .filter((w) => w.date <= period.endISO)
    .sort((a, b) => a.date.localeCompare(b.date));
  const startWeightKg =
    weightSeries.length > 0
      ? weightSeries[0].weightKg
      : priorWeight.length > 0
      ? priorWeight[priorWeight.length - 1].weightKg
      : settings.startWeightKg || null;
  const endWeightKg =
    weightSeries.length > 0 ? weightSeries[weightSeries.length - 1].weightKg : startWeightKg;
  const changeKg =
    startWeightKg !== null && endWeightKg !== null ? round1(endWeightKg - startWeightKg) : null;
  const spanDays = dateList.length;
  const weeklyAvgChangeKg =
    changeKg !== null && spanDays > 0 ? round1((changeKg / spanDays) * 7) : null;

  const currentWeightKg =
    weights.length > 0 ? weights[weights.length - 1].weightKg : settings.startWeightKg || null;

  // Nutrition trend stats — computed over tracked days only so a stretch
  // of unlogged days doesn't drag "lowest calories" down to zero.
  const calorieValues = trackedDays.map((d) => d.calories).filter((c) => c > 0);
  const proteinValues = trackedDays.map((d) => d.protein).filter((p) => p > 0);

  const water = {
    goalMl: settings.waterGoalMl,
    avgMl: Math.round(sumWater / n),
    bestDay:
      days.length > 0
        ? days.reduce((best, d) => (d.waterMl > (best?.waterMl ?? -1) ? d : best), null as ReportDayRow | null)
        : null,
    completionPct: Math.round((days.filter((d) => d.waterGoalMet).length / n) * 100),
  };

  // Food frequency — across all foods (including archived, since a report
  // may cover a period where a food was later archived).
  const freqMap = new Map<string, FoodFrequency>();
  for (const detail of dayDetails) {
    const seenToday = new Set<string>();
    for (const log of byDate.get(detail.date)?.logs ?? []) {
      if (log.loggedQuantity <= 0) continue;
      const food = foods.find((f) => f.id === log.foodId);
      if (!food) continue;
      const mult =
        food.kind === "binary" || food.unit === "serving"
          ? log.loggedQuantity / Math.max(1, food.targetQuantity)
          : log.loggedQuantity;
      const existing = freqMap.get(food.id);
      const calAdd = food.calories * mult;
      if (existing) {
        existing.totalQuantity += log.loggedQuantity;
        existing.totalCalories += calAdd;
        if (!seenToday.has(food.id)) existing.daysLogged += 1;
      } else {
        freqMap.set(food.id, {
          foodId: food.id,
          name: food.name,
          emoji: food.emoji,
          daysLogged: 1,
          totalQuantity: log.loggedQuantity,
          unit: food.unit,
          totalCalories: calAdd,
        });
      }
      seenToday.add(food.id);
    }
  }
  const foodsSorted = Array.from(freqMap.values())
    .map((f) => ({ ...f, totalCalories: Math.round(f.totalCalories) }))
    .sort((a, b) => b.daysLogged - a.daysLogged || b.totalCalories - a.totalCalories)
    .slice(0, 10);

  const achievements: ReportAchievement[] = milestones
    .filter((m) => m.achievedAt >= period.startISO && m.achievedAt <= period.endISO)
    .map((m) => ({ key: m.key, ...milestoneCopy(m.key, settings.goalMode), achievedAt: m.achievedAt }))
    .sort((a, b) => a.achievedAt.localeCompare(b.achievedAt));

  return {
    period,
    userName: userName || "BodyBuddy User",
    userEmail,
    settings,
    days,
    dayDetails,
    summary: {
      daysIncluded: dateList.length,
      daysTracked: trackedDays.length,
      avgCalories: Math.round(sumCalories / n),
      avgProtein: Math.round(sumProtein / n),
      avgCarbs: Math.round(sumCarbs / n),
      avgFats: Math.round(sumFats / n),
      avgWaterMl: Math.round(sumWater / n),
      consistencyScore: Math.round(sumChecklist / n),
      daysGoalAchieved,
      currentWeightKg,
      goalWeightKg: settings.goalWeightKg,
    },
    weight: {
      series: weightSeries,
      startWeightKg,
      endWeightKg,
      changeKg,
      weeklyAvgChangeKg,
    },
    nutrition: {
      highestCalories: calorieValues.length ? Math.max(...calorieValues) : 0,
      lowestCalories: calorieValues.length ? Math.min(...calorieValues) : 0,
      avgCalories: Math.round(sumCalories / n),
      highestProtein: proteinValues.length ? Math.max(...proteinValues) : 0,
      avgProtein: Math.round(sumProtein / n),
    },
    water,
    foods: foodsSorted,
    goalAchievement: {
      calorieDays: daysGoalAchieved,
      proteinDays: days.filter((d) => d.proteinGoalMet).length,
      waterDays: days.filter((d) => d.waterGoalMet).length,
      totalDays: dateList.length,
      checklistCompletionPct: Math.round(sumChecklist / n),
    },
    achievements,
  };
}
