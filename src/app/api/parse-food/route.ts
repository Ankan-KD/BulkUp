import { NextRequest, NextResponse } from "next/server";
import { parseFoodEntry } from "@/lib/parseFood";
import { FoodTemplate } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { text, foods } = (await req.json()) as { text: string; foods: FoodTemplate[] };

  const apiKey = process.env.OPENAI_API_KEY;

  // No key configured (e.g. local dev without .env) — use the fast local
  // heuristic parser so the feature still works end-to-end.
  if (!apiKey) {
    return NextResponse.json({ matches: parseFoodEntry(text, foods), source: "local" });
  }

  try {
    const activeFoods = foods.filter((f) => !f.archived);
    const foodList = activeFoods
      .map(
        (f) =>
          `id="${f.id}" name="${f.name}" aliases=[${f.aliases.join(", ")}] target=${f.targetQuantity}${f.unit}`
      )
      .join("\n");

    const system = `You convert a short sentence about what someone ate into structured log entries against their configured food list. Only match foods that are in the list below. Infer quantities from numbers, or words like "half", "most", "all", "finished" (relative to each food's target). If nothing matches, return an empty array. Respond ONLY with strict JSON, no prose, no markdown fences, matching this shape:
{"matches": [{"foodId": string, "name": string, "addedQuantity": number, "unit": string, "note": string}]}

Food list:
${foodList}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ matches: parseFoodEntry(text, foods), source: "local-fallback" });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return NextResponse.json({ matches: parsed.matches ?? [], source: "openai" });
  } catch {
    return NextResponse.json({ matches: parseFoodEntry(text, foods), source: "local-fallback" });
  }
}
