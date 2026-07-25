import type { FoodCategory } from "./types";

/**
 * Plain data (no JSX/React) describing which lucide-react icon keys are
 * valid for foods and categories. Kept separate from icons.tsx so this can
 * be safely imported from server-side code (e.g. the AI route) without
 * pulling in the React component tree.
 */

export const FOOD_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "Egg", label: "Egg" },
  { key: "Milk", label: "Milk" },
  { key: "Beef", label: "Red meat" },
  { key: "Drumstick", label: "Chicken/poultry" },
  { key: "Fish", label: "Fish/seafood" },
  { key: "Wheat", label: "Rice/grain" },
  { key: "Croissant", label: "Bread/pastry" },
  { key: "Sandwich", label: "Sandwich" },
  { key: "Pizza", label: "Pizza" },
  { key: "Soup", label: "Soup/curry" },
  { key: "Salad", label: "Salad" },
  { key: "Carrot", label: "Vegetable" },
  { key: "Apple", label: "Apple-type fruit" },
  { key: "Banana", label: "Banana" },
  { key: "Cherry", label: "Berries" },
  { key: "Grape", label: "Grapes" },
  { key: "Popcorn", label: "Snack" },
  { key: "Cookie", label: "Biscuit/sweet" },
  { key: "CakeSlice", label: "Dessert" },
  { key: "Candy", label: "Candy" },
  { key: "Coffee", label: "Coffee/tea" },
  { key: "CupSoda", label: "Shake/soda" },
  { key: "GlassWater", label: "Water/juice" },
  { key: "Nut", label: "Nuts" },
  { key: "Utensils", label: "General/other" },
];

export const CATEGORY_ICON_KEYS: Record<FoodCategory, string> = {
  protein: "Drumstick",
  grain: "Wheat",
  vegetable: "Carrot",
  fruit: "Apple",
  dairy: "Milk",
  fat: "Nut",
  custom: "Tag",
  other: "Utensils",
};

export const FALLBACK_ICON_KEY = "Utensils";

export const ALL_ICON_KEYS: string[] = Array.from(
  new Set([...FOOD_ICON_OPTIONS.map((o) => o.key), ...Object.values(CATEGORY_ICON_KEYS), FALLBACK_ICON_KEY])
);
