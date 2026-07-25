import { parseFoodEntry } from "@/lib/parseFood";
import { FoodTemplate } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
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
          emoji: { type: "string" },
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
            enum: ["protein", "grain", "vegetable", "fruit", "dairy", "fat", "other"],
          },
          baseIngredient: { type: "string" },
        },
        required: ["type", "name", "quantityConsumed"],
      },
    },
  },
  required: ["reply", "done", "actions"],
};

function buildSystemPrompt(foods: FoodTemplate[]) {
  const active = foods.filter((f) => !f.archived);
  const foodList = active.length
    ? active
        .map(
          (f) =>
            `- id="${f.id}" name="${f.name}" baseIngredient="${f.baseIngredient || f.name.toLowerCase()}" aliases=[${f.aliases.join(
              ", "
            )}] category=${f.category} kind=${f.kind} unit=${f.unit} targetQuantity=${f.targetQuantity} nutrition(cal/protein/carbs/fats per ${
              f.kind === "binary" || f.unit === "serving" ? "the whole target (i.e. per full serving)" : "1 " + f.unit
            })=${f.calories}/${f.protein}/${f.carbs}/${f.fats}`
        )
        .join("\n")
    : "(none yet — every ingredient will need to be created)";

  return `You are Bulku, an intelligent AI nutrition decomposition assistant inside a weight-gain tracker app.

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
Ignore spices/herbs entirely unless nutritionally significant on their own.

For each action:
- "log_existing": use when an ingredient already exists (matched by name/alias/baseIngredient) in the user's foods below. Set foodId to its exact id. Set quantityConsumed IN THAT INGREDIENT'S OWN UNIT: if unit is "count" (e.g. eggs), quantityConsumed=3 means 3 eggs; if unit is "g"/"ml", quantityConsumed is grams/ml eaten; if kind is "binary" or unit is "serving", set quantityConsumed to that ingredient's own targetQuantity (binary items are all-or-nothing).
- "create_and_log": use when the ingredient doesn't exist yet. Create ONLY that ingredient (never the combined dish). Set kind="binary", unit="serving", targetQuantity=1, quantityConsumed=1 UNLESS the ingredient is something naturally counted or weighed the user might log again later in a different amount — in that case you may instead use kind="quantity" with unit="g"/"ml"/"count" and put nutrition per that unit. When in doubt, prefer kind="binary"/unit="serving" with the full estimated portion baked in, since it's simpler and always correct for a one-off logged amount. Always set "category" (one of the 7 above) and "baseIngredient" (a short lowercase reusable key, e.g. "rice", "chicken", "banana") so this same ingredient can be recognized and reused inside future different dishes. Pick one fitting emoji. Include 2-3 short lowercase aliases.

Be decisive and reasonably accurate with estimates for common ingredients (you know roughly what rice, chicken, dal, roti, paneer, idli, oil, etc. contain per typical serving). Round to sensible whole numbers.

Respond with ONLY valid JSON matching the given schema — no markdown, no explanations, no bullet points outside the JSON. The "reply" field should be short and friendly (max 2 sentences). The "actions" array should contain one action per ingredient detected — a single dish mention like "chicken biryani" should produce MULTIPLE actions (rice, chicken, oil), not one.

The user's existing foods:
${foodList}`;
}

async function callGemini(messages: ChatMessage[], foods: FoodTemplate[]): Promise<ChatResult | null> {
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
    systemInstruction: { parts: [{ text: buildSystemPrompt(foods) }] },
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
function localFallback(messages: ChatMessage[], foods: FoodTemplate[]): ChatResult {
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

  return {
    reply: `Logged ${matches.length} item${matches.length > 1 ? "s" : ""} based on your Foods list. Add a free Gemini API key (GEMINI_API_KEY) to break dishes into ingredients and estimate new ones automatically.`,
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
  const { messages, foods } = (await req.json()) as { messages: ChatMessage[]; foods: FoodTemplate[] };

  if (!messages || messages.length === 0) {
    return NextResponse.json({ reply: "What did you eat?", done: false, actions: [] });
  }

  const gemini = await callGemini(messages, foods);
  if (gemini) return NextResponse.json(gemini);

  return NextResponse.json(localFallback(messages, foods));
}
