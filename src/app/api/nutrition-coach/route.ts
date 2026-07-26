import { FoodTemplate, GoalMode } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

/**
 * Phase 4 — AI Nutrition Coach.
 *
 * Separate from /api/food-chat on purpose: food-chat's job is turning
 * free text into logged ingredients (the existing logging workflow, left
 * unchanged). This route's job is answering coaching questions — most
 * commonly "What can I eat right now?" — using the same Gemini
 * integration, the user's remaining calories/protein, their goal, and
 * their existing food library. It never logs anything itself; it only
 * suggests, and the UI logs a suggestion only when the user taps it.
 */

interface CoachMessage {
  role: "user" | "assistant";
  text: string;
}

interface Suggestion {
  foodId?: string;
  name: string;
  emoji?: string;
  category?: string;
  quantityConsumed?: number;
  reason: string;
}

interface CoachResult {
  reply: string;
  suggestions: Suggestion[];
}

interface CoachRequestContext {
  goalMode: GoalMode;
  calorieGoal: number;
  proteinGoal: number;
  caloriesSoFar: number;
  proteinSoFar: number;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          foodId: { type: "string" },
          name: { type: "string" },
          emoji: { type: "string" },
          category: { type: "string" },
          quantityConsumed: { type: "number" },
          reason: { type: "string" },
        },
        required: ["name", "reason"],
      },
    },
  },
  required: ["reply", "suggestions"],
};

function goalGuidance(goal: GoalMode): string {
  if (goal === "gain") {
    return `The user's goal is to GAIN weight via a healthy calorie surplus.
- Recommend calorie-dense foods (nut butters, whole milk, rice, oats, dried fruit, healthy oils) over low-calorie ones.
- Suggest practical, easy ways to add calories to what they'd eat anyway (add a spoon of peanut butter, extra rice, a glass of milk).
- Encourage meeting the day's surplus target rather than worrying about eating "too much" — as long as it's not wildly beyond a sensible surplus.`;
  }
  if (goal === "lose") {
    return `The user's goal is to LOSE weight via a healthy calorie deficit.
- Recommend filling, high-protein, high-volume foods (lean protein, vegetables, yogurt) that satisfy on fewer calories.
- Suggest healthier swaps for whatever they already tend to eat.
- If remaining calories are low or negative, say so plainly and suggest either a small, light option or waiting — don't recommend something that would blow the budget.`;
  }
  return `The user's goal is to MAINTAIN their current weight.
- Encourage balanced eating across protein/carbs/fats rather than chasing an exact number.
- Focus on consistency — steady, reasonable meals — rather than surplus or deficit framing.`;
}

function buildSystemPrompt(foods: FoodTemplate[], ctx: CoachRequestContext): string {
  const active = foods.filter((f) => !f.archived);
  const foodList = active.length
    ? active
        .map(
          (f) =>
            `- id="${f.id}" name="${f.name}" category=${
              f.category === "custom" ? `custom:${f.customCategory}` : f.category
            } kind=${f.kind} unit=${f.unit} targetQuantity=${f.targetQuantity} nutrition(cal/protein/carbs/fats per ${
              f.kind === "binary" || f.unit === "serving" ? "full serving" : "1 " + f.unit
            })=${f.calories}/${f.protein}/${f.carbs}/${f.fats}`
        )
        .join("\n")
    : "(none yet — the user hasn't added any foods to their library)";

  const remainingCalories = Math.round(ctx.calorieGoal - ctx.caloriesSoFar);
  const remainingProtein = Math.round(ctx.proteinGoal - ctx.proteinSoFar);

  return `You are Buddy, the AI nutrition coach inside BodyBuddy, a goal-based nutrition tracking app. You are NOT the food-logging assistant here — this is a separate coaching conversation. Never log anything yourself; you only recommend, and the app logs a suggestion only if the user taps it.

The user's current status right now:
- Goal: ${ctx.goalMode.toUpperCase()} weight
- Calorie goal: ${ctx.calorieGoal} kcal — logged so far today: ${ctx.caloriesSoFar} kcal — remaining: ${remainingCalories} kcal
- Protein goal: ${ctx.proteinGoal} g — logged so far today: ${ctx.proteinSoFar} g — remaining: ${remainingProtein} g

${goalGuidance(ctx.goalMode)}

The user's food library (their saved foods — strongly prefer suggesting from this list since they already have accurate nutrition info and can log it in one tap):
${foodList}

Your job each turn:
1. Answer the user's question directly and practically. The most common question is "What can I eat right now?" — for that, recommend 2-4 concrete options that fit their remaining calories/protein and goal, prioritizing foods already in their library above. You may suggest a food that isn't in their library if nothing in the library fits well, but mark it clearly as a general suggestion (omit "foodId" for it).
2. Keep "reply" short and conversational — 1-3 sentences, practical over generic ("you have room for X" beats "eat healthy!"). Reference the specific remaining numbers when useful.
3. For "suggestions": one entry per concrete food you recommend. If it's a food from the library above, copy its exact "id" into "foodId" and its exact "category". If it's a general idea not in their library, omit "foodId" and just give a "name" (e.g. "Greek yogurt with berries"). Always give a short "reason" (max ~8 words, e.g. "high protein, fits your remaining budget"). For library foods that are "quantity" kind (unit g/ml/count), you may set "quantityConsumed" to a sensible amount that fits their remaining budget; for "binary"/serving foods, omit it (the app logs the full serving).
4. If the user asks something other than "what can I eat" — e.g. "am I on track today?", "suggest a snack", general motivation or advice — answer that directly using the numbers above. Only include "suggestions" when concrete foods are genuinely part of the answer; otherwise return an empty array.
5. Never invent precise nutrition numbers for foods outside the library (that's not your job here) — keep those as general, no numbers attached.

Respond with ONLY valid JSON matching the given schema — no markdown, no explanations outside the JSON.`;
}

async function callGemini(
  messages: CoachMessage[],
  foods: FoodTemplate[],
  ctx: CoachRequestContext
): Promise<CoachResult | null> {
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
    systemInstruction: { parts: [{ text: buildSystemPrompt(foods, ctx) }] },
    generationConfig: {
      temperature: 0.5,
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
    console.error("Gemini coach request failed", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CoachResult;
  } catch {
    return null;
  }
}

/**
 * Used only when no GEMINI_API_KEY is configured. A small heuristic that
 * still gives useful, goal-aware suggestions: rank the user's own foods by
 * protein-per-calorie (best for lose/maintain) or by raw calories (best
 * for gain), filtered to what fits the remaining budget.
 */
function localFallback(foods: FoodTemplate[], ctx: CoachRequestContext): CoachResult {
  const remainingCalories = Math.round(ctx.calorieGoal - ctx.caloriesSoFar);
  const remainingProtein = Math.round(ctx.proteinGoal - ctx.proteinSoFar);
  const active = foods.filter((f) => !f.archived);

  if (active.length === 0) {
    return {
      reply:
        "Add a few regulars to your Foods tab first, and I can suggest from those. In the meantime, add a free Gemini API key (GEMINI_API_KEY) for smarter, open-ended recommendations.",
      suggestions: [],
    };
  }

  if (ctx.calorieGoal > 0 && remainingCalories <= 0 && ctx.goalMode === "lose") {
    return {
      reply: `You're already at or over today's ${ctx.calorieGoal} kcal budget — I'd hold off or keep anything else very light.`,
      suggestions: [],
    };
  }

  const candidates = active.filter((f) => f.calories > 0 && (remainingCalories <= 0 || f.calories <= Math.max(remainingCalories, 100)));
  const pool = candidates.length ? candidates : active;

  const sorted = [...pool].sort((a, b) => {
    if (ctx.goalMode === "gain") return b.calories - a.calories;
    const ratioA = a.calories > 0 ? a.protein / a.calories : 0;
    const ratioB = b.calories > 0 ? b.protein / b.calories : 0;
    return ratioB - ratioA;
  });

  const top = sorted.slice(0, 3);
  const reasonFor = (f: FoodTemplate) =>
    ctx.goalMode === "gain" ? `${f.calories} kcal — helps close today's surplus` : `${f.protein}g protein for ${f.calories} kcal`;

  return {
    reply:
      ctx.goalMode === "gain"
        ? `You have about ${Math.max(remainingCalories, 0)} kcal left today — these are your most calorie-dense options.`
        : `You have about ${Math.max(remainingCalories, 0)} kcal and ${Math.max(remainingProtein, 0)}g protein left — these fit well.`,
    suggestions: top.map((f) => ({
      foodId: f.id,
      name: f.name,
      emoji: f.emoji,
      category: f.category,
      reason: reasonFor(f),
    })),
  };
}

export async function POST(req: NextRequest) {
  const { messages, foods, coach } = (await req.json()) as {
    messages: CoachMessage[];
    foods: FoodTemplate[];
    coach: CoachRequestContext;
  };

  if (!coach) {
    return NextResponse.json({ reply: "I don't have today's numbers yet — try again in a moment.", suggestions: [] });
  }

  const history: CoachMessage[] =
    messages && messages.length > 0 ? messages : [{ role: "user", text: "What can I eat right now?" }];

  const gemini = await callGemini(history, foods, coach);
  if (gemini) return NextResponse.json(gemini);

  return NextResponse.json(localFallback(foods, coach));
}
