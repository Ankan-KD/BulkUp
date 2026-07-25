export type Unit = "g" | "ml" | "serving" | "count" | "oz";

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
