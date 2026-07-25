export type Unit = "g" | "ml" | "serving" | "count" | "oz";

export type FoodKind = "binary" | "quantity";

export interface FoodTemplate {
  id: string;
  name: string;
  emoji: string;
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
  theme: "light" | "dark" | "system";
  onboarded: boolean;
}

export interface ParsedFoodMatch {
  foodId: string;
  name: string;
  addedQuantity: number;
  unit: Unit;
  note: string; // e.g. "+1", "+150g", "half"
}
