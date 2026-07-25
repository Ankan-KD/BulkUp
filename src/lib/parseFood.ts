import { FoodTemplate, ParsedFoodMatch } from "./types";

const FRACTION_WORDS: Record<string, number> = {
  all: 1,
  everything: 1,
  finished: 1,
  whole: 1,
  most: 0.75,
  half: 0.5,
  quarter: 0.25,
  "a quarter": 0.25,
  "a bit of": 0.25,
  "some of": 0.5,
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  a: 1,
  an: 1,
  couple: 2,
};

/**
 * Very small heuristic parser used when no OpenAI API key is configured,
 * or as an instant client-side preview before the server confirms.
 * Matches food names/aliases in free text and infers quantities from
 * numbers, fraction words ("half", "most"), or defaults to the full target.
 */
export function parseFoodEntry(
  text: string,
  foods: FoodTemplate[]
): ParsedFoodMatch[] {
  const lower = text.toLowerCase();
  const matches: ParsedFoodMatch[] = [];

  for (const food of foods) {
    if (food.archived) continue;
    const names = [food.name.toLowerCase(), ...food.aliases.map((a) => a.toLowerCase())];
    const hit = names.find((n) => lower.includes(n));
    if (!hit) continue;

    // Look for a fraction word near the food mention
    let fraction = 1;
    for (const [word, val] of Object.entries(FRACTION_WORDS)) {
      if (lower.includes(word)) {
        fraction = val;
        break;
      }
    }

    // Look for an explicit number right before the food name, e.g. "2 eggs"
    let explicitCount: number | null = null;
    const numMatch = lower.match(
      new RegExp(`(\\d+|one|two|three|four|five|six|a|an|couple)\\s+(?:${hit.split(" ").join("\\s+")})`)
    );
    if (numMatch) {
      const raw = numMatch[1];
      explicitCount = /^\d+$/.test(raw) ? parseInt(raw, 10) : NUMBER_WORDS[raw] ?? null;
    }

    // Look for explicit gram/ml amount, e.g. "150g chicken"
    const gramMatch = lower.match(/(\d+)\s?(g|ml|grams?|oz)\b/);

    let addedQuantity: number;
    let note: string;

    if (gramMatch) {
      addedQuantity = parseInt(gramMatch[1], 10);
      note = `+${addedQuantity}${food.unit === "ml" ? "ml" : "g"}`;
    } else if (explicitCount !== null && (food.kind === "binary" || food.unit === "count" || food.unit === "serving")) {
      addedQuantity = explicitCount;
      note = `+${explicitCount}`;
    } else {
      addedQuantity = food.targetQuantity * fraction;
      note = fraction === 1 ? "completed" : `${Math.round(fraction * 100)}%`;
    }

    matches.push({
      foodId: food.id,
      name: food.name,
      addedQuantity: Math.round(addedQuantity * 10) / 10,
      unit: food.unit,
      note,
    });
  }

  return matches;
}
