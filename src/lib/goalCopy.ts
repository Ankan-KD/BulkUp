import { GoalMode } from "./types";

/**
 * Central place for all copy and calorie-target logic that changes
 * depending on the user's selected goal (gain / lose / maintain).
 * Keep UI components dumb — they just call these helpers.
 */

export const GOAL_LABELS: Record<GoalMode, string> = {
  gain: "Gain Weight",
  lose: "Lose Weight",
  maintain: "Maintain Weight",
};

export const GOAL_SHORT_LABELS: Record<GoalMode, string> = {
  gain: "Gain",
  lose: "Lose",
  maintain: "Maintain",
};

export const GOAL_DESCRIPTIONS: Record<GoalMode, string> = {
  gain: "Eat in a healthy surplus to build weight over time.",
  lose: "Eat in a healthy deficit to lose weight steadily.",
  maintain: "Stay around maintenance calories and hold steady.",
};

/** Dashboard hero heading, e.g. "Today's Growth" vs "Today's Progress". */
export function dashboardHeading(goal: GoalMode): string {
  if (goal === "gain") return "Today's Growth";
  return "Today's Progress";
}

/** Onboarding finish-button label. */
export function onboardingCta(goal: GoalMode): string {
  if (goal === "gain") return "Start Bulking Up";
  if (goal === "lose") return "Start Your Cut";
  return "Let's Get Started";
}

/** Label for the "kcal left" style stat on the dashboard hero. */
export function calorieRemainingLabel(goal: GoalMode): string {
  if (goal === "lose") return "kcal budget left";
  return "kcal left";
}

/** Weight-page trend copy, e.g. "+3.2 kg gained since start". */
export function weightTrendLabel(goal: GoalMode, changeKg: number): string {
  const sign = changeKg >= 0 ? "+" : "";
  if (goal === "gain") return `${sign}${changeKg} kg gained since start`;
  if (goal === "lose") {
    // For a "lose" goal, progress is framed as weight lost, so a negative
    // change (the expected direction) reads as a positive "lost" amount.
    const lost = Math.round(-changeKg * 10) / 10;
    return `${lost >= 0 ? "" : "+"}${lost} kg lost since start`;
  }
  return `${sign}${changeKg} kg since start`;
}

/**
 * Rough maintenance-calorie estimate from body weight alone (no activity
 * level or profile data is currently collected by the app). This is a
 * simple, commonly used bodyweight multiplier — good enough as a sensible
 * default that the user can immediately tune with the existing calorie
 * stepper; it never overrides a value the user has already set.
 */
export function estimateMaintenanceCalories(weightKg: number): number {
  return Math.round((weightKg * 30) / 50) * 50; // round to nearest 50 kcal
}

/** Short label for a day that hit the calorie goal, e.g. weekly summary stats. */
export function calorieGoalHitLabel(goal: GoalMode): string {
  if (goal === "gain") return "days hit your calorie goal";
  if (goal === "lose") return "days within budget";
  return "days on target";
}

/** Suggested default calorie goal for a given weight + goal mode. */
export function suggestedCalorieGoal(weightKg: number, goal: GoalMode): number {
  const maintenance = estimateMaintenanceCalories(weightKg);
  if (goal === "gain") return maintenance + 500;
  if (goal === "lose") return Math.max(1200, maintenance - 500);
  return maintenance;
}

/**
 * Gently flags when the selected goal mode contradicts the stored goal
 * weight relative to the current weight — e.g. "Lose Weight" while the goal
 * weight is above the current weight. Returns null when there's nothing to
 * flag (including when either weight is unset).
 */
export function goalWeightWarning(
  goal: GoalMode,
  currentWeightKg: number,
  goalWeightKg: number
): string | null {
  if (!currentWeightKg || !goalWeightKg) return null;
  if (goal === "gain" && goalWeightKg <= currentWeightKg) {
    return "Your goal weight is at or below your current weight, but Gain Weight is selected — you may want to raise your goal weight or switch goals.";
  }
  if (goal === "lose" && goalWeightKg >= currentWeightKg) {
    return "Your goal weight is at or above your current weight, but Lose Weight is selected — you may want to lower your goal weight or switch goals.";
  }
  if (goal === "maintain" && Math.abs(goalWeightKg - currentWeightKg) > 4) {
    return "Your goal weight is quite different from your current weight — Maintain Weight works best when they're close together.";
  }
  return null;
}

/**
 * Gently flags a manually-entered calorie goal that falls well outside a
 * sensible range for the selected weight + goal mode — an excessive
 * surplus/deficit, or a target below a safe floor. Returns null when the
 * value looks sensible.
 */
export function calorieGoalWarning(weightKg: number, goal: GoalMode, calorieGoal: number): string | null {
  if (!weightKg || !calorieGoal) return null;
  const maintenance = estimateMaintenanceCalories(weightKg);
  const diff = calorieGoal - maintenance;

  if (calorieGoal < 1200) {
    return "This is a very low calorie target — most guidance recommends staying above ~1,200 kcal/day. Consider raising it or checking with a professional.";
  }
  if (goal === "gain") {
    if (diff < 0) return "This is below your estimated maintenance calories — you may not gain weight at this target.";
    if (diff > 1000) return "This is a large surplus (over 1,000 kcal/day above maintenance) — a smaller surplus of ~300–500 kcal is more sustainable.";
  }
  if (goal === "lose") {
    if (diff > 0) return "This is above your estimated maintenance calories — you may not lose weight at this target.";
    if (diff < -1000) return "This is a large deficit (over 1,000 kcal/day below maintenance) — a deficit of ~300–500 kcal is more sustainable.";
  }
  if (goal === "maintain" && Math.abs(diff) > 300) {
    return "This is noticeably different from your estimated maintenance calories — you may drift from Maintain Weight at this target.";
  }
  return null;
}

/**
 * How today's calorie progress should read for the selected goal mode —
 * drives the dashboard ring's color/state (see GrowthRing).
 * - "good": on track, nothing to flag.
 * - "success": Maintain mode, comfortably within the tolerance band.
 * - "warning": Lose mode, over the calorie budget.
 * - "adjust": Maintain mode, meaningfully over or under the target.
 */
export type ProgressStatus = "good" | "success" | "warning" | "adjust";

export function progressStatus(goal: GoalMode, calories: number, calorieGoal: number): ProgressStatus {
  if (calorieGoal <= 0) return "good";
  const ratio = calories / calorieGoal;
  if (goal === "lose") return ratio > 1 ? "warning" : "good";
  if (goal === "maintain") return ratio >= 0.92 && ratio <= 1.08 ? "success" : "adjust";
  return "good"; // gain: filling toward or beyond target is healthy surplus progress
}

/** Short label shown alongside the ring for non-default statuses. */
export function progressStatusLabel(status: ProgressStatus): string | null {
  if (status === "warning") return "Over budget";
  if (status === "adjust") return "Needs adjustment";
  if (status === "success") return "On target";
  return null;
}

// ── AI Nutrition Coach (Phase 4) ────────────────────────────────────────
// Small copy helpers so the Coach tab reads naturally for the active goal
// mode, mirroring the same adaptive-copy pattern used everywhere else.

/** Short supporting line under the Coach heading. */
export function coachSubheading(goal: GoalMode): string {
  if (goal === "gain") return "Get help hitting today's surplus.";
  if (goal === "lose") return "Get help staying in budget.";
  return "Get help staying consistent.";
}

/** Adaptive quick-question chips shown before the user has asked anything. */
export function coachQuickPrompts(goal: GoalMode): string[] {
  if (goal === "gain") {
    return ["What can I eat right now?", "How do I hit my surplus today?", "Suggest a calorie-dense snack"];
  }
  if (goal === "lose") {
    return ["What can I eat right now?", "Am I within budget today?", "Suggest a filling, high-protein option"];
  }
  return ["What can I eat right now?", "Am I on track today?", "Suggest a balanced snack"];
}
