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
  activeDays: number[]; // 0 = Sunday ... 6 = Saturday (matches JS Date.getDay()). Empty/full = every day. Ignored when dateOnly is set.
  dateOnly: string | null; // ISO yyyy-mm-dd. When set, this food shows up ONLY on this single calendar date (a true one-off), regardless of activeDays — this is what a freshly logged, never-recurring food gets by default. Null means "recurring", governed by activeDays instead.
  category: FoodCategory;
  customCategory: string; // user- or AI-defined label, only meaningful when category === "custom"
  baseIngredient: string; // normalized reusable ingredient key, e.g. "rice", "chicken" — lets the AI recognize the same ingredient across different dishes
}

export interface DailyFoodLog {
  foodId: string;
  loggedQuantity: number; // in the food's unit, capped conceptually at target but can exceed
  // Portion of loggedQuantity that arrived via a Recent Food's diet
  // contribution (e.g. biryani crediting Rice) rather than a direct tap/entry
  // on this Diet item's own checklist row. Purely a display aid — it never
  // affects progress math, only whether Dashboard → Today's Consumption
  // shows this item as directly eaten ("Diet" badge). Optional/omittable
  // for backward-compat with rows logged before this existed (treated as 0).
  contributedQuantity?: number;
}

export interface DayRecord {
  date: string; // ISO yyyy-mm-dd
  logs: DailyFoodLog[]; // Diet foods logged this day
  recentLogs: RecentFoodLogEntry[]; // Recent Foods logged this day (never recurs to another day)
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

// ── Recent Foods (Food System Redesign) ─────────────────────────────────
// Foods eaten that are NOT part of the user's planned Diet (e.g. a one-off
// pizza, biryani, or cake). These never recur automatically and never
// touch Today's Checklist. They're kept in their own catalog + history so
// the app remembers what a person has eaten before without cluttering the
// recurring Diet. A Recent Food can always be promoted into the Diet by
// the user (see StoreContextValue.moveRecentFoodToDiet) — the AI is never
// allowed to do this on its own.

export interface RecentFoodTemplate {
  id: string;
  name: string;
  emoji: string; // lucide-react icon key, see src/lib/icons.tsx
  targetQuantity: number; // the "typical"/last-logged quantity, prefilled next time this is logged again
  unit: Unit;
  kind: FoodKind;
  calories: number; // see FoodTemplate — per unit for quantity foods, per full target for binary/serving foods
  protein: number;
  carbs: number;
  fats: number;
  aliases: string[];
  category: FoodCategory;
  customCategory: string;
  baseIngredient: string; // lets the AI recognize this same item if it reappears inside a different composite dish
  createdAt: string; // ISO yyyy-mm-dd, first time this was logged
}

// One instance of a Recent Food actually being eaten on a given day. A
// Recent Food catalog entry (above) can have many of these over time —
// that history is what lets the Recent Foods tab show "you've had this
// before" instead of just today's snapshot.
export interface RecentFoodLogEntry {
  recentFoodId: string;
  loggedQuantity: number;
  // True if at least one of the day's log entries for this item came with
  // Diet contributions attached (i.e. its ingredients credited one or more
  // Diet items — a "composite dish" like biryani crediting Rice/Chicken/Egg).
  // Drives the Dashboard → Today's Consumption badge: "Mapped" vs "Extra".
  mapped?: boolean;
}

// A Diet item this dish's ingredients contributed toward, and by how much
// (in that Diet food's own unit) — e.g. biryani contributing "150" (grams)
// toward the Rice Diet item. Recorded so the credit is visible/undoable.
export interface DietContribution {
  foodId: string;
  quantity: number;
}

// ── Meal Combos (Phase 2) ───────────────────────────────────────────────
// A saved group of foods (e.g. "Breakfast" = Eggs + Toast + Milk) the user
// can log in a single tap. Reuses the existing FoodTemplate system — each
// item just references a foodId and the quantity to add for that food.

export interface MealComboItem {
  // Exactly one of foodId (a Diet item) / recentFoodId (a Recent Foods
  // catalog entry) is set — a combo only ever references existing items,
  // it never owns/duplicates them.
  foodId?: string;
  recentFoodId?: string;
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

