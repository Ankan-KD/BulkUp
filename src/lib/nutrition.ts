import { DayRecord, FoodTemplate } from "./types";

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

/**
 * calories/protein/carbs/fats on a FoodTemplate are stored "per unit" for
 * quantity foods (e.g. per gram) and "per full target" for binary/serving
 * foods — this normalizes both into a per-unit multiplier.
 */
function perUnitMultiplier(food: FoodTemplate) {
  if (food.kind === "binary" || food.unit === "serving") {
    return 1 / Math.max(1, food.targetQuantity);
  }
  if (food.unit === "count") {
    return 1; // calories field already represents "per count" (e.g. per egg)
  }
  return 1; // g/ml foods already store calories per gram/ml
}

export function computeTotals(foods: FoodTemplate[], day: DayRecord): NutritionTotals {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fats = 0;

  for (const log of day.logs) {
    const food = foods.find((f) => f.id === log.foodId);
    if (!food) continue;
    const mult = perUnitMultiplier(food) * log.loggedQuantity;
    calories += food.calories * mult;
    protein += food.protein * mult;
    carbs += food.carbs * mult;
    fats += food.fats * mult;
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fats: Math.round(fats),
  };
}

export function foodProgress(food: FoodTemplate, loggedQuantity: number) {
  if (food.targetQuantity <= 0) return 0;
  return Math.min(1, Math.max(0, loggedQuantity / food.targetQuantity));
}

export function completionPercent(foods: FoodTemplate[], day: DayRecord): number {
  const active = foods.filter((f) => !f.archived);
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, f) => {
    const log = day.logs.find((l) => l.foodId === f.id);
    return acc + foodProgress(f, log?.loggedQuantity ?? 0);
  }, 0);
  return Math.round((sum / active.length) * 100);
}
