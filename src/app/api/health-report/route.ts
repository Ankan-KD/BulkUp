import { GoalMode } from "@/lib/types";
import { fetchGeminiWithRetry, GEMINI_MODEL } from "@/lib/geminiRetry";
import { NextRequest, NextResponse } from "next/server";

/**
 * Health & Nutrition Report — AI Insights section.
 *
 * Same integration pattern as /api/nutrition-coach: uses the configured
 * Gemini key if present, otherwise falls back to a deterministic, still-
 * useful local summary built straight from the stats (no network call).
 * This route never sees raw day-by-day logs — only the already-computed
 * aggregate stats, keeping the prompt small and the output consistent with
 * what the rest of the PDF shows.
 */

interface InsightsRequestBody {
  goalMode: GoalMode;
  periodLabel: string;
  daysIncluded: number;
  daysTracked: number;
  avgCalories: number;
  calorieGoal: number;
  avgProtein: number;
  proteinGoal: number;
  avgCarbs: number;
  avgFats: number;
  avgWaterMl: number;
  waterGoalMl: number;
  waterCompletionPct: number;
  consistencyScore: number;
  daysGoalAchieved: number;
  startWeightKg: number | null;
  endWeightKg: number | null;
  changeKg: number | null;
  goalWeightKg: number;
  topFoods: string[];
}

interface InsightsResult {
  bullets: string[];
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    bullets: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["bullets"],
};

function buildPrompt(b: InsightsRequestBody): string {
  const weightLine =
    b.changeKg !== null && b.startWeightKg !== null && b.endWeightKg !== null
      ? `Weight went from ${b.startWeightKg}kg to ${b.endWeightKg}kg (${b.changeKg >= 0 ? "+" : ""}${b.changeKg}kg) toward a goal of ${b.goalWeightKg}kg.`
      : "No weight entries were logged in this period.";

  return `You are Buddy, the AI nutrition coach inside BodyBuddy, writing the "AI Insights" page of a printable PDF report for period "${b.periodLabel}". The reader may be the user, or a coach/nutritionist/doctor they shared the report with, so keep it professional, factual, and specific to the numbers below — never generic filler.

Goal mode: ${b.goalMode.toUpperCase()} weight.
Days in period: ${b.daysIncluded} (${b.daysTracked} had any logged data).
Calories: averaged ${b.avgCalories} kcal/day against a goal of ${b.calorieGoal} kcal. Hit the calorie goal on ${b.daysGoalAchieved}/${b.daysIncluded} days.
Protein: averaged ${b.avgProtein}g/day against a goal of ${b.proteinGoal}g.
Carbs: averaged ${b.avgCarbs}g/day. Fats: averaged ${b.avgFats}g/day.
Water: averaged ${b.avgWaterMl}ml/day against a goal of ${b.waterGoalMl}ml (${b.waterCompletionPct}% of days hit the goal).
Consistency score (avg daily checklist completion): ${b.consistencyScore}%.
${weightLine}
Most-logged foods this period: ${b.topFoods.length ? b.topFoods.join(", ") : "none logged"}.

Write 5-8 short bullet points summarizing this period, in plain factual language (like the examples below), covering: overall calorie/protein consistency, any notable pattern (e.g. weekday vs weekend, a nutrient trending low), the weight change and what it means for their goal, and one specific, actionable suggestion for next period. Do not invent numbers not given above. Do not use markdown bold/asterisks. Each bullet should be one sentence, plain text, no leading dash or bullet character (the app adds its own).

Example style:
"You met your calorie goal on 27 of 30 days."
"Protein intake averaged 184g/day, consistently above your target."
"Your weight increased by 1.6kg this period, in line with your gain-weight goal."
"Continue increasing water intake to improve recovery."

Respond with ONLY valid JSON matching the given schema — no markdown, no explanations outside the JSON.`;
}

async function callGemini(b: InsightsRequestBody): Promise<InsightsResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: "Generate the insights now." }] }],
    systemInstruction: { parts: [{ text: buildPrompt(b) }] },
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetchGeminiWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Gemini health-report request failed", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as InsightsResult;
    if (!Array.isArray(parsed.bullets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Used only when no GEMINI_API_KEY is configured — a deterministic,
 * still-specific summary built directly from the stats. */
function localFallback(b: InsightsRequestBody): InsightsResult {
  const bullets: string[] = [];

  if (b.daysIncluded > 0) {
    bullets.push(`You met your calorie goal on ${b.daysGoalAchieved} of ${b.daysIncluded} days.`);
  }
  if (b.avgProtein > 0 && b.proteinGoal > 0) {
    bullets.push(
      `Protein intake averaged ${b.avgProtein}g/day, ${
        b.avgProtein >= b.proteinGoal ? "meeting or exceeding" : "below"
      } your ${b.proteinGoal}g target.`
    );
  }
  if (b.waterGoalMl > 0) {
    bullets.push(
      `Water intake averaged ${b.avgWaterMl}ml/day, hitting your ${b.waterGoalMl}ml goal on ${b.waterCompletionPct}% of days.`
    );
  }
  if (b.changeKg !== null) {
    const dir = b.changeKg > 0 ? "increased" : b.changeKg < 0 ? "decreased" : "stayed steady";
    bullets.push(
      `Your weight ${dir}${b.changeKg !== 0 ? ` by ${Math.abs(b.changeKg)}kg` : ""} over this period.`
    );
  } else {
    bullets.push("No weight entries were logged during this period, so weight trend can't be shown.");
  }
  bullets.push(`Your overall consistency score for this period was ${b.consistencyScore}%.`);
  if (b.topFoods.length > 0) {
    bullets.push(`Your most relied-on foods were ${b.topFoods.slice(0, 3).join(", ")}.`);
  }

  if (b.goalMode === "gain" && b.changeKg !== null && b.changeKg <= 0) {
    bullets.push("Consider a slightly larger calorie surplus next period to support consistent gains.");
  } else if (b.goalMode === "lose" && b.changeKg !== null && b.changeKg >= 0) {
    bullets.push("Consider tightening your calorie budget slightly next period to support steady loss.");
  } else if (b.waterCompletionPct < 70) {
    bullets.push("Increasing water intake could help round out an otherwise solid period.");
  } else {
    bullets.push("Keep up the current routine — the numbers show steady, sustainable progress.");
  }

  return { bullets };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as InsightsRequestBody;

  const gemini = await callGemini(body);
  if (gemini) return NextResponse.json(gemini);

  return NextResponse.json(localFallback(body));
}
