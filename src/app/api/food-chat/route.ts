import { parseFoodEntry } from "@/lib/parseFood";
import { FoodTemplate, GoalMode } from "@/lib/types";
import { FOOD_ICON_OPTIONS } from "@/lib/iconKeys";
import { NextRequest, NextResponse } from "next/server";

const ICON_KEYS = FOOD_ICON_OPTIONS.map((o) => o.key);

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// Today's nutrition context (Phase 4) — lets the model's "reply" text act
// like a coach instead of a plain logging confirmation. Optional so the
// route still works if a caller doesn't send it.
interface CoachContext {
  goalMode: GoalMode;
  calorieGoal: number;
  proteinGoal: number;
  caloriesSoFar: number;
  proteinSoFar: number;
}

interface ChatAction {
  type: "log_existing" | "create_and_log";
  foodId?: string;
  name: string;
  emoji?: string;
  quantityConsumed: number;
  unit?: string;
  kind?: string;
  targetQuantity?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  aliases?: string[];
  category?: string;
  customCategory?: string;
  baseIngredient?: string;
}

interface ChatResult {
  reply: string;
  done: boolean;
  actions: ChatAction[];
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    done: { type: "boolean" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["log_existing", "create_and_log"] },
          foodId: { type: "string" },
          name: { type: "string" },
          emoji: { type: "string", enum: ICON_KEYS },
          quantityConsumed: { type: "number" },
          unit: { type: "string", enum: ["g", "ml", "count", "serving", "oz"] },
          kind: { type: "string", enum: ["binary", "quantity"] },
          targetQuantity: { type: "number" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fats: { type: "number" },
          aliases: { type: "array", items: { type: "string" } },
          category: {
            type: "string",
            enum: ["protein", "grain", "vegetable", "fruit", "dairy", "fat", "custom", "other"],
          },
          customCategory: { type: "string" },
          baseIngredient: { type: "string" },
        },
        required: ["type", "name", "quantityConsumed"],
      },
    },
  },
  required: ["reply", "done", "actions"],
};

function buildSystemPrompt(foods: FoodTemplate[], coach?: CoachContext) {
  const active = foods.filter((f) => !f.archived);
  const foodList = active.length
    ? active
        .map(
          (f) =>
            `- id="${f.id}" name="${f.name}" baseIngredient="${f.baseIngredient || f.name.toLowerCase()}" aliases=[${f.aliases.join(
              ", "
            )}] category=${f.category === "custom" ? `custom:${f.customCategory}` : f.category} kind=${f.kind} unit=${f.unit} targetQuantity=${f.targetQuantity} nutrition(cal/protein/carbs/fats per ${
              f.kind === "binary" || f.unit === "serving" ? "the whole target (i.e. per full serving)" : "1 " + f.unit
            })=${f.calories}/${f.protein}/${f.carbs}/${f.fats}`
        )
        .join("\n")
    : "(none yet — every ingredient will need to be created)";

  return `You are Buddy, an intelligent AI nutrition decomposition assistant inside BodyBuddy, a goal-based nutrition tracking app that helps users gain, lose, or maintain weight.

Your job is not to create dishes. Your job is to understand what the user ate and convert meals into individual nutritional components (ingredients) that can be tracked separately.

The user may describe:
- a complete meal ("I ate chicken biryani")
- multiple foods ("I had eggs and milk")
- vague foods ("I ate some snacks")
- homemade dishes
- restaurant meals

Your job each turn:

1. Understand the COMPLETE conversation history and identify every food item consumed.

2. When the user mentions a combined dish or recipe, BREAK IT DOWN into its major nutritional components.

Examples:

User: "I ate chicken biryani"
Do NOT create: "Chicken Biryani"
Instead break into:
- Rice (carbohydrate)
- Chicken (protein)
- Oil (fat)
(ignore spices — nutritionally negligible)

User: "I ate aloo paratha"
Do NOT create: "Aloo Paratha"
Break into:
- Wheat flour (grain)
- Potato (vegetable/carb)
- Oil/Ghee (fat)

User: "I ate fruit salad"
Do NOT create: "Fruit Salad"
Break into the individual fruits actually mentioned (or a typical mix if unspecified): Apple, Banana, Mango, etc.

3. Always prefer existing ingredients from the user's food database (matched by name, aliases, OR baseIngredient — e.g. if "chicken" already exists as a baseIngredient, reuse it for "chicken" inside any new dish rather than creating a duplicate). If a match exists, use "log_existing". If not, use "create_and_log" and create ONLY that ingredient.

Never create combined dishes as a single food (e.g. never "Chicken Biryani", "Aloo Paratha", "Fruit Salad", "Protein Shake" as one item) — unless the user explicitly says they want that exact combined item tracked as one single food.

4. If the meal contains unknown important details, ask ONE concise question that covers as much as possible at once (e.g. "What type of biryani was it — chicken, egg, mutton, or veg?", or "What kind of noodles and roughly how much?"). Do not ask many small questions. Set "done": false and "actions": [] while asking.

5. If the user says "just estimate", "you decide", "anything is fine", or gives unclear info twice, STOP asking and make a reasonable typical assumption instead.

6. Portion estimation: estimate realistic ingredient-level quantities, not the whole dish's weight. E.g. for chicken biryani: rice ~250-350g cooked, chicken ~100-180g, oil estimated by cooking style. For aloo paratha: estimate grams of wheat flour, potato, and oil/ghee separately. Always estimate the INGREDIENT amount actually consumed, not a generic dish serving.

7. Nutrition rules for anything you create: calories/protein/carbs/fats must represent the EXACT quantity being logged right now, not a per-100g reference value. E.g. if 300g of rice was eaten, calories should be the total for that 300g, not "per 100g".

8. Ingredient categories to use:
- protein: chicken, egg, fish, paneer, dal, meat, protein shake
- grain: rice, wheat, oats, bread, potato-as-carb-source
- vegetable: tomato, onion, carrot, spinach, potato, cucumber, lettuce
- fruit: apple, banana, mango, orange
- dairy: milk, curd, cheese, yogurt
- fat: oil, ghee, butter, nuts, peanut butter, almonds
- other: anything that doesn't fit cleanly (spices, condiments if significant, etc.)
- custom: use this ONLY if the ingredient genuinely doesn't belong in any of the 6 categories above AND deserves its own distinct grouping (e.g. "Whey Protein Powder" as a supplement, "Multivitamin", "Creatine", "Pre-workout"). When you use category="custom", you MUST also set "customCategory" to a short, clear label (e.g. "Supplements", "Pre-workout") — this becomes its own section in the user's Foods list. Don't overuse this; only reach for it when "other" genuinely feels wrong.
Ignore spices/herbs entirely unless nutritionally significant on their own.

For each action:
- "log_existing": use when an ingredient already exists (matched by name/alias/baseIngredient) in the user's foods below. Set foodId to its exact id. Set quantityConsumed IN THAT INGREDIENT'S OWN UNIT: if unit is "count" (e.g. eggs), quantityConsumed=3 means 3 eggs; if unit is "g"/"ml", quantityConsumed is grams/ml eaten; if kind is "binary" or unit is "serving", set quantityConsumed to that ingredient's own targetQuantity (binary items are all-or-nothing).
- "create_and_log": use when the ingredient doesn't exist yet. Create ONLY that ingredient (never the combined dish). Set kind="binary", unit="serving", targetQuantity=1, quantityConsumed=1 UNLESS the ingredient is something naturally counted or weighed the user might log again later in a different amount — in that case you may instead use kind="quantity" with unit="g"/"ml"/"count" and put nutrition per that unit. When in doubt, prefer kind="binary"/unit="serving" with the full estimated portion baked in, since it's simpler and always correct for a one-off logged amount. Always set "category" (one of the options above — including "custom" with a "customCategory" label when genuinely needed) and "baseIngredient" (a short lowercase reusable key, e.g. "rice", "chicken", "banana") so this same ingredient can be recognized and reused inside future different dishes. Set "emoji" to the single best-fitting icon key from this exact list (pick the most specific match — don't default to a generic one when a closer match exists, and don't invent keys outside this list): ${ICON_KEYS.join(", ")}. Include 2-3 short lowercase aliases.

Be decisive and reasonably accurate with estimates for common ingredients (you know roughly what rice, chicken, dal, roti, paneer, idli, oil, etc. contain per typical serving). Round to sensible whole numbers.

Respond with ONLY valid JSON matching the given schema — no markdown, no explanations, no bullet points outside the JSON. The "actions" array should contain one action per ingredient detected — a single dish mention like "chicken biryani" should produce MULTIPLE actions (rice, chicken, oil), not one.

9. COACHING TONE FOR "reply": once you're confident in the ingredient breakdown (done: true, actions populated), don't just confirm what was logged — say that briefly, then act like a lightweight nutrition coach for one more short sentence, using the remaining-calories/remaining-protein numbers below when they're provided. Keep the whole reply to max 2 short sentences total, plain and practical, never preachy or generic ("great job!", "keep it up!" alone don't count). Prefer concrete next actions over praise. Examples of the coaching half of a reply: "You've still got about 30g protein left today — Greek yogurt would fit nicely." / "That puts you close to today's calorie target." / "That's a good chunk of your remaining budget — maybe keep the rest of today lighter." Only give the coaching sentence when you have actions to log; while still asking a clarifying question (done: false), keep the reply focused on that question with no coaching add-on.
${coach ? buildCoachGuidance(coach) : ""}
The user's existing foods:
${foodList}`;
}

/** Goal-aware coaching context + phrasing rules, appended to the system prompt when the caller supplies today's numbers (Phase 4). */
function buildCoachGuidance(coach: CoachContext): string {
  const remainingCalories = Math.round(coach.calorieGoal - coach.caloriesSoFar);
  const remainingProtein = Math.round(coach.proteinGoal - coach.proteinSoFar);
  const goalLine =
    coach.goalMode === "gain"
      ? "The user's goal is to GAIN weight via a calorie surplus. If today's logged calories are still under the target, encourage practical ways to close the gap (calorie-dense foods, an extra serving) rather than just noting the number. Filling or exceeding the target today is healthy progress, not a problem."
      : coach.goalMode === "lose"
      ? "The user's goal is to LOSE weight via a calorie deficit/budget. If this entry pushes them close to or over their remaining calorie budget, gently flag it and suggest a lighter option for later — don't be alarmist, one sentence is enough. Favor recommending filling, high-protein choices when there's still room."
      : "The user's goal is to MAINTAIN their current weight. Favor consistency over hitting an exact number — mention if they're comfortably on track or drifting notably high/low, without being strict about small variance.";

  return `
Today's numbers, for the coaching half of your reply only (do not restate raw JSON, just use these naturally in the sentence):
- Calorie goal: ${coach.calorieGoal} kcal, logged so far (before this message): ${coach.caloriesSoFar} kcal, remaining: ${remainingCalories} kcal
- Protein goal: ${coach.proteinGoal} g, logged so far (before this message): ${coach.proteinSoFar} g, remaining: ${remainingProtein} g
${goalLine}
`;
}

async function callGemini(
  messages: ChatMessage[],
  foods: FoodTemplate[],
  coach?: CoachContext
): Promise<ChatResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const body = {
    contents,
    systemInstruction: { parts: [{ text: buildSystemPrompt(foods, coach) }] },
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Gemini request failed", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ChatResult;
  } catch {
    return null;
  }
}

// Used only when no GEMINI_API_KEY is configured — a single-shot heuristic
// match against the user's existing foods, no conversation, no ingredient
// decomposition, no creation of new foods (that genuinely needs an LLM).
function localFallback(messages: ChatMessage[], foods: FoodTemplate[], coach?: CoachContext): ChatResult {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";
  const matches = parseFoodEntry(lastUser, foods);

  if (matches.length === 0) {
    return {
      reply:
        "I couldn't match that to anything in your Foods list, and breaking meals into ingredients needs a free Gemini API key set up (GEMINI_API_KEY). You can add ingredients manually in the Foods tab for now.",
      done: true,
      actions: [],
    };
  }

  // Simple remaining-calories nudge even without an LLM — keeps the
  // "coach" feel consistent whether or not Gemini is configured.
  let nudge = "";
  if (coach && coach.calorieGoal > 0) {
    const remaining = Math.round(coach.calorieGoal - coach.caloriesSoFar);
    if (coach.goalMode === "lose" && remaining < 0) {
      nudge = ` You're now over today's calorie budget — a lighter next meal would help.`;
    } else if (remaining > 0) {
      nudge = ` About ${remaining} kcal left today.`;
    }
  }

  return {
    reply: `Logged ${matches.length} item${matches.length > 1 ? "s" : ""} based on your Foods list.${nudge} Add a free Gemini API key (GEMINI_API_KEY) to break dishes into ingredients and estimate new ones automatically.`,
    done: true,
    actions: matches.map((m) => ({
      type: "log_existing" as const,
      foodId: m.foodId,
      name: m.name,
      quantityConsumed: m.addedQuantity,
    })),
  };
}

export async function POST(req: NextRequest) {
  const { messages, foods, coach } = (await req.json()) as {
    messages: ChatMessage[];
    foods: FoodTemplate[];
    coach?: CoachContext;
  };

  if (!messages || messages.length === 0) {
    return NextResponse.json({ reply: "What did you eat?", done: false, actions: [] });
  }

  const gemini = await callGemini(messages, foods, coach);
  if (gemini) return NextResponse.json(gemini);

  return NextResponse.json(localFallback(messages, foods, coach));
}
