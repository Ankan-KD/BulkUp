// Master Food Database — a curated, read-only nutrition reference bundled
// into the app at build time (src/data/masterFoodDatabase.json, generated
// from src/data/master-food-database.source.csv).
//
// This is intentionally NOT a database table the running app can write to.
// It's a static JSON import: there is no code path anywhere in this app
// that mutates it, so it can't be tampered with by users, the AI, or a
// compromised client — the only way it changes is by re-generating the
// JSON from the source CSV and redeploying. See src/data/README.md for
// how to regenerate it.
//
// Used to (a) ground the AI's nutrition estimates in real data instead of
// letting it guess from scratch, and (b) give the no-Gemini-key fallback
// path a way to recognize common dishes it otherwise couldn't handle.

import raw from "@/data/masterFoodDatabase.json";
import { CATEGORY_ICON_KEYS } from "./iconKeys";
import type { FoodCategory, FoodKind, Unit } from "./types";

export interface MasterFoodEntry {
  id: number;
  category: string;
  subcategory: string;
  name: string;
  /** Regional/vernacular name kept in its own field instead of being folded
   * into the name or crammed into aliases (e.g. name "Split Bengal Gram
   * Dal", localName "Channa Dal"). Empty string when there isn't one. */
  localName: string;
  aliases: string[];
  servingSize: number | null;
  servingUnit: string;
  weightG: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  satFat: number;
  sodiumMg: number;
  cholesterolMg: number;
  foodType: string;
  /** Real-world ingredients this dish/food is made of (e.g. Chicken Biryani
   * -> ["Rice","Chicken","Yogurt","Onion","Spices"]). Curated ground truth —
   * prefer this over guessing when deciding Case 3 Diet-item credit, since
   * it's actual data rather than an LLM's assumption about what a dish
   * contains. Empty for raw/single-ingredient entries where it wouldn't add
   * anything (e.g. "Rice" itself doesn't need an ingredients list). */
  ingredients: string[];
}

const MASTER_FOODS = raw as MasterFoodEntry[];

// Lowercased (name + localName + aliases) list per entry, built once, for
// fast exact-substring matching.
const INDEX: { entry: MasterFoodEntry; terms: string[] }[] = MASTER_FOODS.map((entry) => ({
  entry,
  terms: [
    entry.name.toLowerCase(),
    ...(entry.localName ? [entry.localName.toLowerCase()] : []),
    ...entry.aliases.map((a) => a.toLowerCase()),
  ],
}));

// ── Phonetic/transliteration normalization ───────────────────────────────
// Exact substring matching above misses spelling variants that are
// extremely common with Hindi/Hinglish romanization — there's no single
// "correct" spelling, so a dish typed as "sabji" won't match an alias
// stored as "sabzi", "paneer" vs "panir", "kadhai" vs "kadai", etc. This
// collapses away that ambiguity (z/j, w/v, ph/f, doubled letters, silent
// h's) so both the stored terms and whatever the user typed reduce to the
// same key, catching the same class of mismatch a human reader wouldn't
// even notice as different spellings.
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/z/g, "j")
    .replace(/w/g, "v")
    .replace(/ph/g, "f")
    // Aspirated consonants are frequently romanized inconsistently —
    // "dhal"/"dal", "bhujia"/"bujia", "kheer"/"kher" — so drop the 'h'
    // after these consonant letters.
    .replace(/([bdgjkpt])h/g, "$1")
    // Long/short vowel variants ("paneer"/"panir", "kheer"/"khir") — fold
    // ee/ii down to a single i so both sides of that variance collapse to
    // the same key.
    .replace(/(ee|ii)/g, "i")
    .replace(/(.)\1+/g, "$1") // collapse any remaining doubled letters
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_INDEX: { entry: MasterFoodEntry; terms: string[] }[] = INDEX.map(({ entry, terms }) => ({
  entry,
  terms: Array.from(new Set(terms.map(normalizeForMatch).filter((t) => t.length >= 3))),
}));

/**
 * Finds Master Food Database entries whose name/alias appears in the given
 * free text, longest match first (so "chicken biryani" prefers the
 * "Chicken Biryani" row over the plainer "Chicken" or "Rice" rows).
 * Returns at most `limit` entries — callers only need a handful of
 * candidates, not every partial hit.
 */
export function findMasterFoodMatches(text: string, limit = 8): MasterFoodEntry[] {
  const lower = text.toLowerCase();
  const hits: { entry: MasterFoodEntry; termLength: number }[] = [];

  for (const { entry, terms } of INDEX) {
    const hit = terms.find((t) => t.length >= 3 && lower.includes(t));
    if (hit) hits.push({ entry, termLength: hit.length });
  }

  // Longest matched term first (more specific match), then — since many
  // vernacular aliases like "aloo" are tagged on dozens of loosely-related
  // entries and tie on term length — prefer shorter/more generic dish
  // names on ties, since those are more likely to be the actual base dish
  // ("Potato Curry") rather than a narrow variant ("Cauliflower, Pea and
  // Potato Bhujia") that happens to share the same alias.
  hits.sort((a, b) => b.termLength - a.termLength || a.entry.name.length - b.entry.name.length);

  // De-dupe by entry id (an entry can match via both name and an alias).
  const seen = new Set<number>();
  const out: MasterFoodEntry[] = [];
  for (const { entry } of hits) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
    if (out.length >= limit) break;
  }

  // Fallback pass: if exact substring matching found nothing, retry against
  // the phonetically-normalized index. Kept as a strictly-second pass (not
  // merged into the first) so it never demotes/reorders a precise exact
  // match — it only fires when exact matching would otherwise return
  // nothing, e.g. "sabji" typed against an alias stored as "sabzi".
  if (out.length === 0) {
    const normalizedLower = normalizeForMatch(text);
    const normHits: { entry: MasterFoodEntry; termLength: number }[] = [];
    for (const { entry, terms } of NORMALIZED_INDEX) {
      const hit = terms.find((t) => normalizedLower.includes(t));
      if (hit) normHits.push({ entry, termLength: hit.length });
    }
    normHits.sort((a, b) => b.termLength - a.termLength || a.entry.name.length - b.entry.name.length);
    for (const { entry } of normHits) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      out.push(entry);
      if (out.length >= limit) break;
    }
  }

  return out;
}

/** Best single match for a short, single-dish query (used by the fallback). */
export function findBestMasterFoodMatch(text: string): MasterFoodEntry | null {
  return findMasterFoodMatches(text, 1)[0] ?? null;
}

/**
 * Typeahead search for the "Add to Diet" picker — ranks name/alias matches
 * that START WITH the query above ones that merely contain it, then by
 * name length (shorter/closer matches first). Unlike findMasterFoodMatches
 * (which scans free-form sentences for embedded food names), this is for a
 * person actively typing a food name into a search box.
 */
export function searchMasterFoods(query: string, limit = 20): MasterFoodEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const starts: MasterFoodEntry[] = [];
  const contains: MasterFoodEntry[] = [];
  const seen = new Set<number>();

  for (const { entry, terms } of INDEX) {
    if (seen.has(entry.id)) continue;
    if (terms.some((t) => t.startsWith(q))) {
      starts.push(entry);
      seen.add(entry.id);
    } else if (terms.some((t) => t.includes(q))) {
      contains.push(entry);
      seen.add(entry.id);
    }
  }

  starts.sort((a, b) => a.name.length - b.name.length);
  contains.sort((a, b) => a.name.length - b.name.length);

  const results = [...starts, ...contains];

  // Same spelling-variant fallback as findMasterFoodMatches: only kicks in
  // when exact matching came up empty.
  if (results.length === 0 && q.length >= 3) {
    const nq = normalizeForMatch(q);
    const normMatches: MasterFoodEntry[] = [];
    for (const { entry, terms } of NORMALIZED_INDEX) {
      if (seen.has(entry.id)) continue;
      if (terms.some((t) => t.includes(nq))) {
        normMatches.push(entry);
        seen.add(entry.id);
      }
    }
    normMatches.sort((a, b) => a.name.length - b.name.length);
    return normMatches.slice(0, limit);
  }

  return results.slice(0, limit);
}

// Master Food Database categories -> this app's (much smaller) Diet
// category set. Anything not listed here becomes "custom", tagged with the
// Master DB's own category name, so the Foods page still groups it
// sensibly instead of dumping everything into "Other".
const MASTER_CATEGORY_MAP: Record<string, FoodCategory> = {
  Proteins: "protein",
  "Grains & Cereals": "grain",
  Vegetables: "vegetable",
  "Starchy Vegetables": "vegetable",
  Fruits: "fruit",
  Dairy: "dairy",
  "Nuts & Seeds": "fat",
  "Oils & Fats": "fat",
};

export function mapMasterCategory(entry: MasterFoodEntry): { category: FoodCategory; customCategory: string } {
  const mapped = MASTER_CATEGORY_MAP[entry.category];
  if (mapped) return { category: mapped, customCategory: "" };
  return { category: "custom", customCategory: entry.category };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface DietPrefill {
  name: string;
  category: FoodCategory;
  customCategory: string;
  emoji: string;
  unit: Unit;
  kind: FoodKind;
  targetQuantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  aliases: string[];
  baseIngredient: string;
}

/**
 * Converts a Master Food Database entry into prefilled Diet-item fields.
 * This never touches the master database itself — it just hands the user
 * a fully-filled-out starting point they can freely edit; whatever they
 * save goes into their own foods table, same as manual entry always has.
 *
 * The master DB records nutrition "per servingSize servingUnit" (e.g. per
 * 100g, or per 1 bowl/piece/biscuit/etc). Two cases:
 *  - servingUnit is g/ml: the app's own "g"/"ml" units expect nutrition
 *    PER 1 unit, so we divide down to a per-gram/per-ml figure, and default
 *    the target quantity to the entry's typical weight — multiplying the
 *    two back out reproduces the reference values exactly.
 *  - any other (named/counted) servingUnit — bowl, piece, biscuit, slice,
 *    etc: mapped to the app's "serving" unit, whose nutrition fields mean
 *    "per full target" — so the reference values are used as-is, with the
 *    target quantity defaulted to the entry's serving count (usually 1).
 */
export function masterFoodToDietPrefill(entry: MasterFoodEntry): DietPrefill {
  const { category, customCategory } = mapMasterCategory(entry);
  const servingUnit = (entry.servingUnit || "").trim().toLowerCase();
  const size = entry.servingSize && entry.servingSize > 0 ? entry.servingSize : 1;

  let unit: Unit;
  let targetQuantity: number;
  let calories: number;
  let protein: number;
  let carbs: number;
  let fats: number;

  if (servingUnit === "g" || servingUnit === "ml") {
    unit = servingUnit as Unit;
    targetQuantity = Math.round(entry.weightG && entry.weightG > 0 ? entry.weightG : size);
    calories = round2(entry.calories / size);
    protein = round2(entry.protein / size);
    carbs = round2(entry.carbs / size);
    fats = round2(entry.fat / size);
  } else {
    unit = "serving";
    targetQuantity = Math.round(size) || 1;
    calories = round2(entry.calories);
    protein = round2(entry.protein);
    carbs = round2(entry.carbs);
    fats = round2(entry.fat);
  }

  const aliases = [
    ...(entry.localName ? [entry.localName] : []),
    ...entry.aliases,
  ].filter((a) => a.toLowerCase() !== entry.name.toLowerCase());

  return {
    name: entry.name,
    category,
    customCategory,
    emoji: CATEGORY_ICON_KEYS[category],
    unit,
    kind: "quantity",
    targetQuantity,
    calories,
    protein,
    carbs,
    fats,
    aliases,
    baseIngredient: entry.name.toLowerCase(),
  };
}

/**
 * Renders a compact reference block for a set of entries, suitable for
 * dropping into an LLM system prompt as grounding context. Nutrition is
 * always given per the entry's own serving so the model can scale it.
 */
export function formatMasterFoodsForPrompt(entries: MasterFoodEntry[]): string {
  if (entries.length === 0) return "(no reference matches for this message)";
  return entries
    .map(
      (e) =>
        `- "${e.name}"${e.localName ? ` (${e.localName})` : ""} [${e.category}/${e.subcategory}] per ${e.servingSize ?? 100}${e.servingUnit || "g"}` +
        `${e.weightG ? ` (~${e.weightG}g)` : ""}: ${e.calories} kcal, ${e.protein}g protein, ${e.carbs}g carbs, ${e.fat}g fat` +
        `${e.ingredients.length ? ` — ingredients: ${e.ingredients.join(", ")}` : ""}`
    )
    .join("\n");
}
