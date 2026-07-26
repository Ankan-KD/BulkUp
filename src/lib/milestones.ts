import { DayRecord, FoodTemplate, GoalMode, MilestoneKey, UserSettings, WeightEntry } from "./types";
import { computeStreaks } from "./streaks";

/**
 * Milestones (Phase 3). Achievement is computed from data the app already
 * has — no new inputs required. Once a milestone is true it's meant to stay
 * true (see how peak gain/loss and best-ever streak are used below, rather
 * than "right now" snapshots), so a brief dip never revokes something the
 * user already earned. Which milestones even apply is goal-mode aware, per
 * the "must respect the user's active goal" requirement.
 */

const MAINTAIN_GOAL_TOLERANCE_KG = 2;
const STREAK_MILESTONE_DAYS = 30;
const FIRST_WEEK_DAYS = 7;
const FIRST_MONTH_DAYS = 30;
const FIRST_MILESTONE_KG = 5;

export function applicableMilestoneKeys(goal: GoalMode): MilestoneKey[] {
  const base: MilestoneKey[] = ["first_week", "first_month", "goal_reached", "streak_30_day"];
  if (goal === "gain") return [...base, "first_5kg_gained"];
  if (goal === "lose") return [...base, "first_5kg_lost"];
  return base; // maintain: neither gain- nor loss-direction milestones apply
}

export function milestoneCopy(key: MilestoneKey, goal: GoalMode): { title: string; description: string } {
  switch (key) {
    case "first_week":
      return { title: "First Week Completed", description: "Logged your first 7 days" };
    case "first_month":
      return { title: "First Month Completed", description: "Logged your first 30 days" };
    case "first_5kg_gained":
      return { title: "First 5 kg Gained", description: "Gained 5 kg since you started" };
    case "first_5kg_lost":
      return { title: "First 5 kg Lost", description: "Lost 5 kg since you started" };
    case "goal_reached":
      return {
        title: "Goal Reached",
        description: goal === "maintain" ? "Holding steady at your target weight" : "Reached your goal weight",
      };
    case "streak_30_day":
      return { title: "30-Day Streak", description: "Hit your calorie goal 30 days in a row" };
  }
}

export interface MilestoneStatus {
  key: MilestoneKey;
  title: string;
  description: string;
  achieved: boolean;
}

export function computeMilestoneStatuses(
  foods: FoodTemplate[],
  history: DayRecord[],
  today: DayRecord,
  weights: WeightEntry[],
  settings: UserSettings
): MilestoneStatus[] {
  const trackedDates = new Set<string>();
  for (const d of [...history, today]) {
    if (d.logs.length > 0 || d.weightKg !== undefined) trackedDates.add(d.date);
  }
  const trackedCount = trackedDates.size;

  const streaks = computeStreaks(foods, history, today, settings);

  const latestWeight = weights.length > 0 ? weights[weights.length - 1].weightKg : undefined;

  let peakGainKg = 0;
  let peakLossKg = 0;
  if (settings.startWeightKg > 0) {
    for (const w of weights) {
      peakGainKg = Math.max(peakGainKg, w.weightKg - settings.startWeightKg);
      peakLossKg = Math.max(peakLossKg, settings.startWeightKg - w.weightKg);
    }
  }

  let goalReached = false;
  if (settings.goalWeightKg > 0 && latestWeight !== undefined) {
    if (settings.goalMode === "gain") goalReached = latestWeight >= settings.goalWeightKg;
    else if (settings.goalMode === "lose") goalReached = latestWeight <= settings.goalWeightKg;
    else goalReached = Math.abs(latestWeight - settings.goalWeightKg) <= MAINTAIN_GOAL_TOLERANCE_KG;
  }

  const achievedMap: Record<MilestoneKey, boolean> = {
    first_week: trackedCount >= FIRST_WEEK_DAYS,
    first_month: trackedCount >= FIRST_MONTH_DAYS,
    first_5kg_gained: peakGainKg >= FIRST_MILESTONE_KG,
    first_5kg_lost: peakLossKg >= FIRST_MILESTONE_KG,
    goal_reached: goalReached,
    streak_30_day: streaks.calorie.best >= STREAK_MILESTONE_DAYS,
  };

  return applicableMilestoneKeys(settings.goalMode).map((key) => ({
    key,
    ...milestoneCopy(key, settings.goalMode),
    achieved: achievedMap[key],
  }));
}
