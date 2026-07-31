import { DayRecord, FoodTemplate, RecentFoodTemplate } from "./types";

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

// Shape shared by FoodTemplate and RecentFoodTemplate for nutrition math —
// lets computeTotals/computeRecentTotals use one multiplier helper for both.
interface NutritionSource {
  kind: FoodTemplate["kind"];
  unit: FoodTemplate["unit"];
  targetQuantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

/**
 * calories/protein/carbs/fats on a food are stored "per unit" for
 * quantity foods (e.g. per gram) and "per full target" for binary/serving
 * foods — this normalizes both into a per-unit multiplier.
 */
function perUnitMultiplier(food: NutritionSource) {
  if (food.kind === "binary" || food.unit === "serving") {
    return 1 / Math.max(1, food.targetQuantity);
  }
  if (food.unit === "count") {
    return 1; // calories field already represents "per count" (e.g. per egg)
  }
  return 1; // g/ml foods already store calories per gram/ml
}

function emptyTotals(): NutritionTotals {
  return { calories: 0, protein: 0, carbs: 0, fats: 0 };
}

function addTotals(a: NutritionTotals, b: NutritionTotals): NutritionTotals {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fats: a.fats + b.fats,
  };
}

function round(t: NutritionTotals): NutritionTotals {
  return {
    calories: Math.round(t.calories),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fats: Math.round(t.fats),
  };
}

/**
 * Same as computeTotals, but only counts the *directly* logged portion of
 * each Diet item — i.e. loggedQuantity minus whatever was credited via a
 * Recent Food's ingredients (creditContribution). Use this wherever Diet
 * totals are being added to Recent Foods totals, since a dish like an
 * omelette already bakes its egg content into its own Recent Foods
 * calories — counting the credited Eggs portion again here would double
 * that ingredient's calories/macros.
 */
function computeDirectDietTotals(foods: FoodTemplate[], day: DayRecord): NutritionTotals {
  let totals = emptyTotals();
  for (const log of day.logs) {
    const food = foods.find((f) => f.id === log.foodId);
    if (!food) continue;
    const directQuantity = Math.max(0, log.loggedQuantity - (log.contributedQuantity ?? 0));
    const mult = perUnitMultiplier(food) * directQuantity;
    totals = addTotals(totals, {
      calories: food.calories * mult,
      protein: food.protein * mult,
      carbs: food.carbs * mult,
      fats: food.fats * mult,
    });
  }
  return round(totals);
}

/** Totals from Diet items logged today only (unrounded internally, rounded on return). */
export function computeTotals(foods: FoodTemplate[], day: DayRecord): NutritionTotals {
  let totals = emptyTotals();
  for (const log of day.logs) {
    const food = foods.find((f) => f.id === log.foodId);
    if (!food) continue;
    const mult = perUnitMultiplier(food) * log.loggedQuantity;
    totals = addTotals(totals, {
      calories: food.calories * mult,
      protein: food.protein * mult,
      carbs: food.carbs * mult,
      fats: food.fats * mult,
    });
  }
  return round(totals);
}

/** Totals from Recent Foods logged today only. */
export function computeRecentTotals(recentFoods: RecentFoodTemplate[], day: DayRecord): NutritionTotals {
  let totals = emptyTotals();
  for (const log of day.recentLogs ?? []) {
    const food = recentFoods.find((f) => f.id === log.recentFoodId);
    if (!food) continue;
    const mult = perUnitMultiplier(food) * log.loggedQuantity;
    totals = addTotals(totals, {
      calories: food.calories * mult,
      protein: food.protein * mult,
      carbs: food.carbs * mult,
      fats: food.fats * mult,
    });
  }
  return round(totals);
}

/**
 * Full day total — Diet items + Recent Foods combined. This is what should
 * drive "calories/macros consumed today", since a Recent Food (e.g. a
 * biryani whose ingredients don't fully match the Diet) still counts
 * toward what the person actually ate.
 *
 * Diet items only contribute their *directly*-logged quantity here
 * (computeDirectDietTotals) — quantity credited via a Recent Food's
 * ingredients is intentionally excluded, because that dish's Recent Foods
 * entry already carries the full nutrition for what was eaten, egg/rice/
 * whatever included. Counting both would double that ingredient's
 * calories/macros for the day.
 */
export function computeCombinedTotals(
  foods: FoodTemplate[],
  recentFoods: RecentFoodTemplate[],
  day: DayRecord
): NutritionTotals {
  return round(addTotals(computeDirectDietTotals(foods, day), computeRecentTotals(recentFoods, day)));
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
