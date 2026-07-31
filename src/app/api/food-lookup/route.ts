import { FOOD_ICON_OPTIONS } from "@/lib/iconKeys";
import { fetchGeminiWithRetry, GEMINI_MODEL } from "@/lib/geminiRetry";
import { NextRequest, NextResponse } from "next/server";

const ICON_KEYS = FOOD_ICON_OPTIONS.map((o) => o.key);

// ── Manual-log AI estimate ───────────────────────────────────────────────
// Used only by the "Log manually" flow (ManualLogSheet) when the user types
// a food name that isn't in the local Master Food Database. A single Gemini
// call — grounded with a real Google Search — estimates a full Recent Foods
// template (name/category/unit/nutrition/etc) for a typical single portion,
// which the user can then edit before saving. Kept to ONE call (unlike the
// two-call food-chat flow) since this is a much simpler, single-item task
// with no conversation/decomposition to reason about — search grounding and
// schema-enforced JSON output can't be combined in one Gemini request, so
// this prompts for JSON in plain text and parses it defensively instead.
interface LookupResult {
  name: string;
  category: string;
  customCategory: string;
  emoji: string;
  unit: string;
  kind: string;
  targetQuantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  aliases: string[];
  baseIngredient: string;
}

const VALID_UNITS = new Set(["g", "ml", "count", "serving", "oz"]);
const VALID_KINDS = new Set(["binary", "quantity"]);
const VALID_CATEGORIES = new Set(["protein", "grain", "vegetable", "fruit", "dairy", "fat", "custom", "other"]);

function parseLoose(raw: string): Record<string, unknown> | null {
  const fenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(fenced);
  } catch {
    // fall through to brace-matching
  }
  const start = fenced.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < fenced.length; i++) {
    if (fenced[i] === "{") depth++;
    else if (fenced[i] === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(fenced.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function normalize(name: string, obj: Record<string, unknown>): LookupResult {
  const unit = VALID_UNITS.has(String(obj.unit)) ? (obj.unit as string) : "serving";
  const kind = VALID_KINDS.has(String(obj.kind)) ? (obj.kind as string) : "binary";
  const category = VALID_CATEGORIES.has(String(obj.category)) ? (obj.category as string) : "other";
  const emoji = ICON_KEYS.includes(String(obj.emoji)) ? (obj.emoji as string) : "Utensils";
  const aliases = Array.isArray(obj.aliases) ? obj.aliases.filter((a) => typeof a === "string").slice(0, 4) : [];

  return {
    name: str(obj.name, name),
    category,
    customCategory: category === "custom" ? str(obj.customCategory, "Other") : "",
    emoji,
    unit,
    kind,
    targetQuantity: num(obj.targetQuantity, 1) || 1,
    calories: Math.round(num(obj.calories)),
    protein: Math.round(num(obj.protein) * 10) / 10,
    carbs: Math.round(num(obj.carbs) * 10) / 10,
    fats: Math.round(num(obj.fats) * 10) / 10,
    aliases,
    baseIngredient: str(obj.baseIngredient, name.toLowerCase()),
  };
}

// Gated behind the same flag food-chat uses. "Grounding with Google
// Search" is metered on its own small, separate free-tier quota from the
// model's own request quota — calling it unconditionally here (as this
// route previously did) burns that quota on every manual food add even
// when GEMINI_ENABLE_SEARCH_GROUNDING=false, which is what was causing
// 429s here specifically. Off by default; falls back to the model's own
// food knowledge, same as food-chat does.
const ENABLE_SEARCH_GROUNDING = process.env.GEMINI_ENABLE_SEARCH_GROUNDING === "true";

async function lookupViaGemini(name: string): Promise<LookupResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `A user is manually logging a food they ate in a nutrition tracking app. The food they typed (it may be in Hindi/Hinglish, another language, a regional name, a misspelling, or a brand name) is:

"${name}"

${ENABLE_SEARCH_GROUNDING
    ? "Use Google Search to confirm what this food/dish actually is, then estimate its nutrition for ONE typical single-person portion."
    : "Identify what this food/dish actually is from your own food knowledge, then estimate its nutrition for ONE typical single-person portion."}

Reply with ONLY a single JSON object, no markdown fences, no commentary, in exactly this shape:
{
  "name": "standard English name, Title Case",
  "category": "one of: protein, grain, vegetable, fruit, dairy, fat, custom, other",
  "customCategory": "short label, ONLY if category is custom, else omit",
  "emoji": "the single best-fitting icon key from this exact list: ${ICON_KEYS.join(", ")}",
  "unit": "one of: g, ml, count, serving, oz",
  "kind": "\\"quantity\\" if this food is naturally weighed/counted and portions vary a lot (e.g. rice, chicken, milk) — nutrition values below must then be PER 1 unit. \\"binary\\" if it's more natural as one whole item/serving (e.g. a dish, a snack, a piece of fruit) — nutrition values below must then be for the WHOLE typical portion.",
  "targetQuantity": "a typical amount in that unit (e.g. 150 for g, 1 for serving/count)",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fats": number (grams),
  "aliases": ["2-3 short lowercase alternate names"],
  "baseIngredient": "short lowercase reusable key, e.g. \\"biryani\\", \\"potato\\""
}

Be decisive and realistic — use real nutrition knowledge for the identified food${ENABLE_SEARCH_GROUNDING ? ", grounded by the search result" : ""}, not a wild guess.`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(ENABLE_SEARCH_GROUNDING ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: { temperature: 0.3 },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetchGeminiWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[food-lookup] Gemini request failed", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    if (!raw) return null;

    const parsed = parseLoose(raw);
    if (!parsed) {
      console.warn("[food-lookup] Could not parse JSON out of the model's response:", raw);
      return null;
    }
    return normalize(name, parsed);
  } catch (err) {
    console.warn("[food-lookup] errored", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { name } = (await req.json()) as { name?: string };
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Missing food name" }, { status: 400 });
  }

  const result = await lookupViaGemini(name.trim());
  if (!result) {
    return NextResponse.json(
      { error: "Couldn't estimate nutrition for that food — try entering the values manually." },
      { status: 502 }
    );
  }
  return NextResponse.json(result);
}
