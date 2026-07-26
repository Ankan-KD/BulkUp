export type Unit = "g" | "ml" | "serving" | "count" | "oz";

// The user's overall body-weight goal. This drives calorie-target direction
// and copy throughout the app (see src/lib/goalCopy.ts).
export type GoalMode = "gain" | "lose" | "maintain";

export type FoodKind = "binary" | "quantity";

export type FoodCategory = "protein" | "grain" | "vegetable" | "fruit" | "dairy" | "fat" | "custom" | "other";

export interface FoodTemplate {
  id: string;
  name: string;
  emoji: string; // a lucide-react icon key (e.g. "Drumstick", "Carrot") — see src/lib/icons.tsx. Kept as "emoji" for backward-compat with the DB column name; it no longer stores a raw emoji character.
  targetQuantity: number;
  unit: Unit;
  calories: number; // calories per full target
  protein: number; // grams per full target
  carbs: number;
  fats: number;
  aliases: string[];
  sortOrder: number;
  archived: boolean;
  kind: FoodKind;
  activeDays: number[]; // 0 = Sunday ... 6 = Saturday (matches JS Date.getDay()). Empty/full = every day.
  category: FoodCategory;
  customCategory: string; // user- or AI-defined label, only meaningful when category === "custom"
  baseIngredient: string; // normalized reusable ingredient key, e.g. "rice", "chicken" — lets the AI recognize the same ingredient across different dishes
}

export interface DailyFoodLog {
  foodId: string;
  loggedQuantity: number; // in the food's unit, capped conceptually at target but can exceed
}

export interface DayRecord {
  date: string; // ISO yyyy-mm-dd
  logs: DailyFoodLog[];
  waterMl: number;
  weightKg?: number;
}

export interface WeightEntry {
  date: string;
  weightKg: number;
}

export interface UserSettings {
  name: string;
  goalMode: GoalMode;
  calorieGoal: number;
  proteinGoal: number;
  goalWeightKg: number;
  startWeightKg: number;
  waterGoalMl: number;
  units: "metric" | "imperial";
  theme: "light" | "dark" | "system" | "princess";
  onboarded: boolean;
}

export interface ParsedFoodMatch {
  foodId: string;
  name: string;
  addedQuantity: number;
  unit: Unit;
  note: string; // e.g. "+1", "+150g", "half"
}

// ── Meal Combos (Phase 2) ───────────────────────────────────────────────
// A saved group of foods (e.g. "Breakfast" = Eggs + Toast + Milk) the user
// can log in a single tap. Reuses the existing FoodTemplate system — each
// item just references a foodId and the quantity to add for that food.

export interface MealComboItem {
  foodId: string;
  quantity: number; // in the referenced food's unit; for binary foods this equals its targetQuantity
}

export interface MealCombo {
  id: string;
  name: string;
  icon: string; // a lucide-react icon key, see src/lib/icons.tsx
  items: MealComboItem[];
  sortOrder: number;
}

// ── Habits & Motivation (Phase 3) ───────────────────────────────────────
// Lightweight streaks + milestone celebrations. Streaks are computed on the
// fly from existing history (see src/lib/streaks.ts) and never stored
// directly. Milestones ARE persisted — once unlocked they stay unlocked,
// and we need a record to know a celebration has already been shown.

export type MilestoneKey =
  | "first_week"
  | "first_month"
  | "first_5kg_gained"
  | "first_5kg_lost"
  | "goal_reached"
  | "streak_30_day";

export interface MilestoneRecord {
  key: MilestoneKey;
  achievedAt: string; // ISO yyyy-mm-dd, the date this app instance first detected it
}

