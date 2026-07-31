import { parseFoodEntry } from "@/lib/parseFood";
import { FoodTemplate, GoalMode, RecentFoodTemplate } from "@/lib/types";
import { FOOD_ICON_OPTIONS } from "@/lib/iconKeys";
import { findMasterFoodMatches, findBestMasterFoodMatch, formatMasterFoodsForPrompt } from "@/lib/masterFoods";
import { fetchGeminiWithRetry, GEMINI_MODEL } from "@/lib/geminiRetry";
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

// A Diet item this dish's ingredients cover, and how much of it (in that
// Diet food's own unit) — e.g. { foodId: "<Rice's id>", foodName: "Rice", quantity: 150 }.
// `foodName` is redundant with `foodId` by design: if the model's echoed
// id ever drifts from the real Diet item id, the server can still recover
// the correct id by matching this name against the Diet list instead of
// silently losing the credit.
interface DietContributionInput {
  foodId: string;
  foodName: string;
  quantity: number;
}

// ── Food System Redesign — logging actions ──────────────────────────────
// Exactly two action types now, matching the app's two Foods sections:
//
// "log_diet"   — Case 1: the food is already a Diet item. Just update its
//                progress for today. Never creates anything.
//
// "log_recent" — Case 2 & 3: the food/dish is NOT a Diet item. It always
//                gets logged into Recent Foods as ONE entry (never
//                decomposed into separate foods, and never added to the
//                Diet). If its ingredients happen to match existing Diet
//                items (Case 3), `dietContributions` credits those Diet
//                items in the same action — but the dish itself still
//                only ever lives in Recent Foods.
//
// The AI can never create or modify a Diet item — that table is only ever
// written to by the user (the + button, or "move to Diet").
interface ChatAction {
  type: "log_diet" | "log_recent";

  // log_diet — required.
  foodId?: string;
  quantityConsumed?: number; // in that Diet food's own unit

  // log_recent — describes the dish/food being logged into Recent Foods.
  recentFoodId?: string; // set when reusing an existing Recent Foods catalog entry
  name?: string;
  emoji?: string;
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
  quantityConsumedRecent?: number; // quantity for the Recent Foods entry itself

  // Case 3 only — Diet items this dish's ingredients contribute toward.
  dietContributions?: DietContributionInput[];
}

// One entry per active Diet item, forced by the schema below. Making the
// model state this explicitly for EVERY Diet item (instead of only
// deciding actions directly) is what actually fixes the "biryani didn't
// credit Rice/Chicken/Egg on the first message" bug: without a dedicated
// place to do this check, a fast/low-temp model can skip straight to
// writing the JSON and silently drop the Case 3 reasoning the prose
// instructions asked for. This can't be skipped since it's `required`.
interface DietCoverageCheckItem {
  foodId: string;
  foodName: string;
  isIngredient: boolean; // true if this message's food(s) contain this Diet item as a real ingredient
  estimatedQuantity?: number; // in that Diet item's own unit, only meaningful when isIngredient is true
}

interface ChatResult {
  reply: string;
  done: boolean;
  actions: ChatAction[];
  dietCoverageCheck?: DietCoverageCheckItem[];
}

// Used by the decision call only (see callGemini) — the search-grounded
// identification call doesn't use this, since Gemini doesn't support
// combining a search tool with schema-enforced output in the same request.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    dietCoverageCheck: {
      type: "array",
      description:
        "REQUIRED scratchpad, filled in BEFORE deciding actions. One entry for EVERY active Diet item listed in the prompt (even if there's only one food in the message and it's obviously unrelated to most Diet items — still list all of them). For each, decide whether the food(s) in this message contain it as a real-world ingredient (Case 3 logic), and if so, your best estimate of the quantity in that Diet item's own unit.",
      items: {
        type: "object",
        properties: {
          foodId: { type: "string" },
          foodName: { type: "string" },
          isIngredient: { type: "boolean" },
          estimatedQuantity: { type: "number" },
        },
        required: ["foodId", "foodName", "isIngredient"],
      },
    },
    reply: { type: "string" },
    done: { type: "boolean" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["log_diet", "log_recent"] },
          foodId: { type: "string" },
          quantityConsumed: { type: "number" },
          recentFoodId: { type: "string" },
          name: { type: "string" },
          emoji: { type: "string", enum: ICON_KEYS },
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
          quantityConsumedRecent: { type: "number" },
          dietContributions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                foodId: { type: "string" },
                foodName: { type: "string" },
                quantity: { type: "number" },
              },
              required: ["foodId", "foodName", "quantity"],
            },
          },
        },
        required: ["type"],
      },
    },
  },
  required: ["dietCoverageCheck", "reply", "done", "actions"],
};


function buildSystemPrompt(
  foods: FoodTemplate[],
  recentFoods: RecentFoodTemplate[],
  coach?: CoachContext,
  latestUserMessage?: string,
  groundedIdentification?: string | null
) {
  const active = foods.filter((f) => !f.archived);
  const dietList = active.length
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
    : "(none — every Diet item the user has set up)";

  const recentList = recentFoods.length
    ? recentFoods
        .slice(0, 60)
        .map(
          (f) =>
            `- id="${f.id}" name="${f.name}" aliases=[${f.aliases.join(", ")}] kind=${f.kind} unit=${f.unit} targetQuantity=${f.targetQuantity}`
        )
        .join("\n")
    : "(none yet)";

  return `You are Buddy, an AI food-logging assistant inside BodyBuddy, a goal-based nutrition tracking app that helps users gain, lose, or maintain weight.

BodyBuddy splits foods into two completely separate places:
- **Diet**: the user's planned, recurring foods (set up by the user themselves — you can NEVER add, remove, or edit anything here).
- **Recent Foods**: a history of everything else the user actually eats — one-off meals, dishes, snacks. Nothing here repeats automatically and nothing here is ever added to the Diet by you.

STEP 0 — IDENTIFY BEFORE YOU MATCH: The user may describe food in Hindi/Hinglish, another language, a regional name, a misspelling, or a brand name (e.g. "aloo ki sabji", "aloo ki sabzi", "poha"). A real Google Search has ALREADY been run on this message for you — see "Search-grounded identification" below. Treat that as verified, up-to-date ground truth for what the food/dish actually is and what it's made of, and prefer it over your own assumptions whenever the two would differ (a brand name, a regional dish you might not recognize, anything time-sensitive). Use that identified English name/ingredients — not the user's literal original wording, and not a guess of your own that contradicts it — for every matching step below: against the Diet list, the Recent Foods catalog, and especially the Master Food Database reference — compare by MEANING (what the dish actually is), never by literal text/spelling overlap alone. Only if the search result is missing, empty, or genuinely unhelpful for this item should you identify it from your own food knowledge instead. Only once you've checked the Diet list, Recent Foods, and the Master Food Database and found no reasonable match should you fall back to estimating nutrition purely from knowledge — never invent numbers with no basis at all.

Search-grounded identification for this message (from a real Google Search — use this, don't re-derive it from scratch):
${groundedIdentification ? groundedIdentification : "(search unavailable this turn — identify from your own food knowledge instead)"}

Your job each turn: read what the user says they ate and decide, for EACH distinct food/dish mentioned, which of these THREE cases applies:

**Case 1 — the food IS a Diet item** (matched by name, alias, or baseIngredient against the Diet list below — use the English name you identified in Step 0 for this comparison).
Example: user has "Eggs" in their Diet and says "I ate 2 eggs."
→ Use action "log_diet": foodId = the Diet item's id, quantityConsumed = amount in THAT item's own unit (2 for count, target amount for binary/serving items).
→ Do NOT create a Recent Foods entry for this. Nothing else happens.

**Case 2 — the food is NOT a Diet item, and it doesn't decompose into ingredients that match the Diet** (a composite dish, snack, or meal with no overlap with the Diet).
Example: user has no biryani-related items in their Diet and says "I ate biryani."
→ Use action "log_recent": this logs the dish AS ONE ENTRY into Recent Foods (never split into separate rows for rice/chicken/oil — one dish, one entry). Estimate nutrition for the WHOLE portion the user actually ate — prefer a matching Master Food Database entry's figures (scaled to portion) over estimating from scratch when one clearly applies (see Step 0 and the Master Food Database section below).
→ Do NOT add anything to the Diet.

**Case 3 — the food is NOT a Diet item itself, but its REAL-WORLD ingredients match existing Diet items.**
Determine this using your actual knowledge of what the named dish is made of — NOT by checking whether the dish's name shares letters/words with a Diet item's name. Most dishes that trigger Case 3 won't share any text with the Diet item they credit at all.
- Example A (multi-ingredient dish): Diet contains Rice, Chicken, Egg. User says "I ate one plate of biryani."
  → "Biryani" doesn't literally contain the words "rice"/"chicken"/"egg", but you know a biryani IS made from them.
- Example B (single-ingredient-dominant dish — just as valid a Case 3, don't skip these): Diet contains "Eggs". User says "I had an omelette" (or "boiled egg", "scrambled eggs", "egg curry", "egg sandwich", etc.)
  → An omelette IS eggs (cooked with a little oil/butter/milk) — same rule applies even though it's basically one ingredient and the name doesn't say "egg."
  → Use action "log_recent" (one Recent Foods entry: "Omelette", with the whole dish's nutrition — egg(s) plus the oil/butter/etc used to cook it), AND set "dietContributions" crediting "Eggs" with however many eggs a typical omelette of the stated size uses (e.g. 2, in that Diet item's own unit/count).
- In both cases: use action "log_recent" (log the dish as ONE Recent Foods entry with its own whole-dish nutrition — never split into separate rows), AND set "dietContributions": an array crediting each matching Diet item with how much of it this portion likely covers (in that Diet item's own unit, e.g. grams of rice, count of eggs). Estimate conservatively but reasonably from typical proportions for that dish and the stated portion size. For EVERY entry, set BOTH "foodId" (copied EXACTLY, character-for-character, from that Diet item's id= value below) AND "foodName" (that same Diet item's name= value below) — never paraphrase or invent either one, and never leave foodName out even if you're confident about foodId.
→ NEVER ask the user for a quantity/portion size, even if the message is vague (e.g. "I had some biryani" with no size at all). Always proceed straight to "done": true with your best estimate — use a typical single-adult-portion size as the default (prefer a matching Master Food Database entry's serving size when one applies), and note the assumed portion briefly in "reply" (e.g. "Logged ~1 plate of biryani"). The user can always correct the amount afterward from the Recent Foods tab, so a reasonable guess now is always better than stopping to ask.

General rules:
- Prefer reusing an existing Recent Foods entry (below) over creating a duplicate — match by name/alias, case-insensitively (e.g. if "Pizza" was already logged before, reuse its id via "recentFoodId" rather than creating a new "Pizza" entry). Still re-estimate calories/nutrition for THIS instance's portion size if it's described differently.
- Never invent a Diet action — "log_diet" is ONLY for foods that are already literally in the Diet list below. You are never allowed to create, edit, or schedule a Diet item, no matter how the user phrases their request (even "add rice to my everyday diet" — for that, tell the user in your reply to use the + button in Foods, or move a Recent Food into the Diet themselves).
- A single message can produce multiple actions, but ONLY one action per distinct dish/food the user actually named — e.g. "eggs and biryani" → exactly one log_diet for eggs, exactly one log_recent for biryani (never more than one action for "biryani" itself).
- CRITICAL — Case 3 is always ONE action, never several: when a dish's ingredients credit Diet items, that credit MUST be the "dietContributions" array inside that dish's single "log_recent" action. NEVER emit a separate "log_diet" action, and NEVER emit additional "log_recent" actions, to represent an ingredient that's merely implied by a dish (e.g. crediting Rice/Chicken/Egg for "biryani" is three entries inside ONE log_recent's dietContributions — it is never three extra actions, and it is never three extra chips). A standalone "log_diet" action is ONLY correct when the user named that exact Diet item on its own as its own food (Case 1) — not when it's your own inference about what a dish contains.
- Every "log_recent" action MUST have either a "name" (new entry) or a "recentFoodId" (reusing an existing catalog entry) — never emit a "log_recent" action with neither, and never use a placeholder/generic name like "Food" or "Meal".
- If the user mentions multiple unrelated foods, handle each with its own case — but "unrelated" means textually different dishes, not the ingredients of one dish.
- Don't let a dish being "basically just one Diet ingredient" push you toward Case 1 or Case 2 instead of Case 3 — the deciding question is always "is the user describing eating this Diet item directly/by its own name (Case 1), or a dish/preparation that's made from it (Case 3)?" Both "I ate eggs" (Case 1) and "I had an omelette" (Case 3, crediting Eggs) are common and both must work.
- Biryani and omelette above are just illustrations of the pattern, not a fixed list — apply the exact same Case 3 check to EVERY dish/food the user mentions, for every message, regardless of cuisine, language, or how obscure the dish is: potato dishes credit a "Potato"/"Aloo" Diet item, dal credits "Lentils", a sandwich with cheese credits "Cheese", etc. Run this ingredient-vs-Diet check on every distinct food every single time — never skip it because a dish "seems unrelated" to the Diet at a glance.

For a NEW "log_recent" entry (no matching recentFoodId to reuse):
- Choose the unit the way a person actually thinks about that food — don't default to binary/serving out of laziness:
  - Naturally weighed foods (chicken breast, paneer, rice as a side, cooked vegetables) → "kind"="quantity", "unit"="g", nutrition per 1 gram, "quantityConsumedRecent" = the estimated gram amount eaten.
  - Naturally poured/liquid foods (milk, juice, a soft drink) → "kind"="quantity", "unit"="ml", nutrition per 1 ml, "quantityConsumedRecent" = the estimated ml amount.
  - Naturally counted whole items (an egg, a banana, a scoop of protein powder, a tablespoon of peanut butter) → "kind"="quantity", "unit"="count" (or "g"/"ml" if a scoop/tbsp is more naturally weighed — use judgement), nutrition per 1 unit, "quantityConsumedRecent" = the count.
  - Composite dishes/meals with no single natural unit (biryani, a sandwich, a pizza slice, a thali) → "kind"="binary", "unit"="serving", "targetQuantity"=1, "quantityConsumedRecent"=1, with the FULL estimated nutrition for the whole portion baked in.
  - When genuinely unsure, prefer binary/serving as the fallback — but only after actually considering whether a g/ml/count unit would be more natural for this specific food, not by default.
- CRITICAL for binary/serving entries: because "1 serving" alone is meaningless to the user later (a biryani "serving" could reasonably be 180g or 650g), you MUST also estimate the total edible weight in grams for the portion you're logging right now, and state it briefly in "reply" (e.g. "Logged ~1 plate (~350g) of chicken biryani"). This is for the user's own clarity/comparison across days — always include it in the reply text for binary/serving entries, never omit it.
- Always set "category" (protein/grain/vegetable/fruit/dairy/fat/other, or "custom" with a "customCategory" label only when genuinely needed — e.g. "Whey Protein Powder", "Multivitamin") and "baseIngredient" (a short lowercase reusable key, e.g. "biryani", "pizza", "omelette") so repeats can be matched later.
- Set "emoji" to the single best-fitting icon key from this exact list (pick the most specific match): ${ICON_KEYS.join(", ")}.
- Include 2-3 short lowercase aliases.
- Portion/nutrition estimation: be decisive and reasonably accurate (you know roughly what common dishes and ingredients contain per typical serving/portion). Nutrition values must represent the EXACT quantity being logged right now, not a generic per-100g reference. Round to sensible whole numbers.

For "dietContributions" (Case 3): estimate the ingredient-level amount actually consumed (e.g. chicken biryani for one adult plate: rice ~250-300g, chicken ~120-150g), not the whole dish's weight, and express each in that Diet item's own unit/kind (count for binary/count items, grams/ml for quantity items — for binary/serving Diet items just credit the full targetQuantity if a normal portion clearly covers it).

Coaching tone for "reply": once you're confident in what to log (done: true, actions populated — this should be almost every turn, since you never stop to ask for quantities), briefly confirm what was logged (mentioning any assumed portion size in passing), then add ONE short nutrition-coach sentence using the remaining-calories/remaining-protein numbers below when provided. Keep the whole reply to max 2 short sentences, plain and practical, never generic praise. Only leave "done": false with empty "actions" in the rare case the message contains no identifiable food at all (e.g. "hey" or a question about the app) — ask what they ate, don't ask about portion sizes.
${coach ? buildCoachGuidance(coach) : ""}
The user's Diet (Case 1 matches only — never modify this list):
${dietList}

The user's Recent Foods catalog (reuse via "recentFoodId" when the same dish/food reappears):
${recentList}

Master Food Database reference (a curated nutrition dataset — NOT the user's own foods). These candidates were pre-filtered by a simple text search, so they may include noisy/unrelated results — some are matched only because a vernacular alias (e.g. "aloo") is loosely tagged on many entries. Use the English name/ingredients you identified in Step 0 to judge, by MEANING, whether any of these entries is actually a clear match for the dish described — not by whichever one happens to be listed first. When one clearly IS the dish (or a major ingredient of it), prefer its real figures (scaled to the portion the user describes) over estimating from scratch — it's more accurate and keeps values consistent across users. When a matched entry lists "ingredients", treat that as curated ground truth for the Case 3 check (which of THIS dish's ingredients match a Diet item) — prefer it over your own assumption about what the dish contains, the same way you prefer Step 0's search-grounded identification over guessing. If nothing below is genuinely the right match, ignore the noise and estimate normally from your own knowledge instead of forcing a fit:
${latestUserMessage ? formatMasterFoodsForPrompt(findMasterFoodMatches(latestUserMessage, 15)) : "(none provided)"}`;
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

// ── Validation ───────────────────────────────────────────────────────────
// Gemini's structured output can drift: it might echo back a Master Food
// Database numeric id, a slightly-off id, or otherwise misfire the
// `foodId` field inside "log_diet" or "dietContributions". Nothing was
// checking that id against the actual Diet items we sent it, so a drifted
// id would silently write a log row for a food that doesn't exist —
// crediting nothing on the Diet checklist while the reply text still
// confidently said "credited to your Diet". This validates every foodId
// the model returns against the real Diet ids before the result ever
// reaches the client, dropping (and logging) anything that doesn't match
// instead of letting it fail silently downstream.
function findFoodByName(foods: FoodTemplate[], name: string | undefined): FoodTemplate | undefined {
  if (!name) return undefined;
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return foods.find(
    (f) =>
      f.name.trim().toLowerCase() === needle ||
      f.aliases.some((a) => a.trim().toLowerCase() === needle)
  );
}

const VALID_UNITS = new Set(["g", "ml", "count", "serving", "oz"]);
const VALID_KINDS = new Set(["binary", "quantity"]);
const VALID_CATEGORIES = new Set(["protein", "grain", "vegetable", "fruit", "dairy", "fat", "custom", "other"]);

// Previously responseSchema's enum constraints guaranteed these fields could
// only ever be one of the allowed values. Without it, a model can drift
// (e.g. unit: "grams" instead of "g", or an emoji key that isn't in
// ICON_KEYS) — which would silently break nutrition math or icon rendering
// downstream. This clamps each enum-like field on a log_recent action to a
// safe fallback instead of trusting it blindly.
function normalizeLogRecentAction(action: ChatAction): ChatAction {
  const next = { ...action };
  if (next.unit && !VALID_UNITS.has(next.unit)) {
    console.warn(`[food-chat] Unrecognized unit "${next.unit}" — defaulting to "serving".`);
    next.unit = "serving";
  }
  if (next.kind && !VALID_KINDS.has(next.kind)) {
    console.warn(`[food-chat] Unrecognized kind "${next.kind}" — defaulting to "binary".`);
    next.kind = "binary";
  }
  if (next.category && !VALID_CATEGORIES.has(next.category)) {
    console.warn(`[food-chat] Unrecognized category "${next.category}" — defaulting to "other".`);
    next.category = "other";
  }
  if (next.emoji && !ICON_KEYS.includes(next.emoji)) {
    console.warn(`[food-chat] Unrecognized emoji key "${next.emoji}" — defaulting to "utensils".`);
    next.emoji = ICON_KEYS.includes("utensils") ? "utensils" : ICON_KEYS[0];
  }
  return next;
}

// Safety net for the dietCoverageCheck field: if the model correctly
// flagged a Diet item as an ingredient of this message's food(s) but
// forgot to also copy that into a log_recent action's dietContributions
// (the actual failure mode reported — model says "yes this is an
// ingredient" in its reasoning but the credit doesn't make it into the
// action), this reconciles the two instead of silently losing the credit.
// Attaches any missing-but-flagged credits to the first log_recent action
// in the turn (the common case is exactly one dish per message); if there
// is no log_recent action to attach to, there's nothing safe to do and the
// flag is dropped.
function reconcileDietCoverage(
  actions: ChatAction[],
  coverage: DietCoverageCheckItem[] | undefined,
  validIds: Set<string>
): ChatAction[] {
  if (!coverage || coverage.length === 0) return actions;

  const alreadyCredited = new Set<string>();
  for (const a of actions) {
    if (a.type === "log_diet" && a.foodId) alreadyCredited.add(a.foodId);
    if (a.type === "log_recent" && a.dietContributions) {
      for (const c of a.dietContributions) if (c.foodId) alreadyCredited.add(c.foodId);
    }
  }

  const missing = coverage.filter(
    (c) => c.isIngredient && c.foodId && validIds.has(c.foodId) && !alreadyCredited.has(c.foodId)
  );
  if (missing.length === 0) return actions;

  const targetIdx = actions.findIndex((a) => a.type === "log_recent");
  if (targetIdx === -1) return actions; // no dish to attach the credit to — nothing safe to do

  const target = { ...actions[targetIdx] };
  target.dietContributions = [
    ...(target.dietContributions ?? []),
    ...missing.map((m) => ({
      foodId: m.foodId,
      foodName: m.foodName,
      quantity: typeof m.estimatedQuantity === "number" ? m.estimatedQuantity : 0,
    })),
  ];
  const next = [...actions];
  next[targetIdx] = target;
  return next;
}

function validateChatResult(result: ChatResult, foods: FoodTemplate[]): ChatResult {
  const validIds = new Set(foods.map((f) => f.id));

  const actions: ChatAction[] = [];
  // Guards against the model splitting one dish's implied ingredients into
  // extra standalone log_diet actions instead of a single log_recent's
  // dietContributions (see the system prompt's "CRITICAL — Case 3 is
  // always ONE action" rule). We can't always tell from a bare foodId
  // whether a log_diet action reflects the user literally naming that
  // Diet item vs. the model incorrectly crediting an inferred ingredient,
  // but we CAN stop the runaway-duplication failure mode: cap how many
  // log_diet actions a single turn is allowed to produce, since a person
  // describing what they ate rarely names more than a handful of literal
  // Diet items in one message, while a mis-decomposed dish can emit one
  // per ingredient.
  const MAX_LOG_DIET_PER_TURN = 4;
  let logDietCount = 0;
  for (const rawAction of result.actions) {
    const action = rawAction.type === "log_recent" ? normalizeLogRecentAction(rawAction) : rawAction;
    if (action.type === "log_diet") {
      if (!(action.foodId && validIds.has(action.foodId))) {
        console.warn(
          `[food-chat] Dropping log_diet action — foodId "${action.foodId}" is not a known Diet item id.`
        );
        continue;
      }
      logDietCount++;
      if (logDietCount > MAX_LOG_DIET_PER_TURN) {
        console.warn(
          `[food-chat] Dropping log_diet action for "${action.foodId}" — turn already produced ${MAX_LOG_DIET_PER_TURN} log_diet actions, likely a mis-decomposed dish that should have used dietContributions instead.`
        );
        continue;
      }
      actions.push(action);
      continue;
    }

    // log_recent — every entry needs either a real name (new entry) or a
    // recentFoodId that actually points at an existing catalog item;
    // otherwise it's a malformed action that would previously fall back
    // to a placeholder "Food" name client-side and render as junk chips.
    // Drop it instead of guessing.
    const hasUsableName = typeof action.name === "string" && action.name.trim().length > 0;
    const hasUsableRecentId = typeof action.recentFoodId === "string" && action.recentFoodId.trim().length > 0;
    if (!hasUsableName && !hasUsableRecentId) {
      console.warn(
        `[food-chat] Dropping log_recent action — neither "name" nor "recentFoodId" was provided (raw: ${JSON.stringify(
          rawAction
        )}).`
      );
      continue;
    }

    // Reject a brand-new catalog entry (no recentFoodId to reuse existing
    // nutrition from) if the model didn't actually supply calories. This is
    // the root cause of "0 kcal / 0g protein" ghost entries showing up in
    // Recent Foods: calories/protein/carbs/fats are optional on ChatAction,
    // so a model response that simply omitted them (schema-valid, since
    // they aren't in `required`) used to fall through to `?? 0` downstream
    // and silently log a phantom zero-nutrition food. A real food is never
    // actually 0 kcal, so treat this as a failed estimate and drop it
    // rather than logging garbage.
    if (!hasUsableRecentId && !(typeof action.calories === "number" && action.calories > 0)) {
      console.warn(
        `[food-chat] Dropping new log_recent action for "${action.name}" — model returned no usable calories (got ${JSON.stringify(
          action.calories
        )}), refusing to log a 0-kcal ghost entry.`
      );
      continue;
    }

    // For each dietContribution: if the returned foodId matches a real Diet item,
    // keep it as-is. If it doesn't, try to recover by matching the
    // model-supplied foodName against the Diet list's names/aliases
    // instead of losing the credit outright. Only drop it if neither the
    // id nor the name lines up with anything real.
    if (action.dietContributions?.length) {
      const validContributions: DietContributionInput[] = [];
      for (const c of action.dietContributions) {
        if (c.foodId && validIds.has(c.foodId)) {
          validContributions.push(c);
          continue;
        }

        const recovered = findFoodByName(foods, c.foodName);
        if (recovered) {
          console.warn(
            `[food-chat] Corrected dietContribution — foodId "${c.foodId}" didn't match, recovered "${recovered.name}" (${recovered.id}) via foodName "${c.foodName}" (dish: "${action.name ?? action.recentFoodId ?? "unknown"}").`
          );
          validContributions.push({ ...c, foodId: recovered.id });
          continue;
        }

        console.warn(
          `[food-chat] Dropping dietContribution — foodId "${c.foodId}" and foodName "${c.foodName}" both failed to match a known Diet item (dish: "${action.name ?? action.recentFoodId ?? "unknown"}").`
        );
      }
      actions.push({ ...action, dietContributions: validContributions });
    } else {
      actions.push(action);
    }
  }

  // Final pass: collapse duplicate NEW log_recent entries for the same dish
  // name within one turn. Legitimate multi-food messages ("eggs and toast
  // and biryani") should still produce several distinct-named entries — this
  // only removes repeats of the SAME name, which is the shape a
  // mis-decomposed dish takes even after the name/id checks above (e.g. the
  // model emitting "Meat Biryani" three times instead of once).
  const seenNewRecentNames = new Set<string>();
  const deduped: ChatAction[] = [];
  for (const action of actions) {
    if (action.type === "log_recent" && !action.recentFoodId && action.name) {
      const key = action.name.trim().toLowerCase();
      if (seenNewRecentNames.has(key)) {
        console.warn(`[food-chat] Dropping duplicate log_recent action for "${action.name}" within the same turn.`);
        continue;
      }
      seenNewRecentNames.add(key);
    }
    deduped.push(action);
  }
  actions.length = 0;
  actions.push(...reconcileDietCoverage(deduped, result.dietCoverageCheck, validIds));

  // Safety net: a model can produce a confident-sounding "I've logged X"
  // reply with `done: true` while the structured `actions` array is empty
  // (or everything in it got dropped above for pointing at ids that don't
  // exist) — nothing was actually recorded, but the text says otherwise.
  // Weaker/cheaper models are more prone to this than a mismatched-id
  // parsing bug, so don't let the client show a success message for a
  // request that logged nothing.
  if (result.done && actions.length === 0) {
    console.warn(
      `[food-chat] Model returned done:true with zero usable actions (raw reply: "${result.reply}") — overriding so the client doesn't show a false success.`
    );
    return {
      done: false,
      actions: [],
      reply:
        "I wasn't able to confidently match that to your Diet or work out its ingredients that time — try adding a bit more detail (like the portion size), or log it directly from the Recent Foods tab.",
    };
  }

  return { ...result, actions };
}

// ── Call 1: real Google-Search grounding ────────────────────────────────
// A dedicated, schema-free call whose only job is identification — English
// name, real ingredients, and a typical portion for anything the decision
// call might not already know confidently. Kept separate from the decision
// call because Gemini doesn't support combining the google_search tool with
// schema-enforced (responseSchema) output in one request, and the decision
// call below benefits enough from full schema enforcement that it's worth
// paying for two calls instead of relaxing that.
// Fails soft: on any error/timeout/non-2xx, returns null and the decision
// call just falls back to identifying from its own knowledge (same as
// before this feature existed) instead of the whole request breaking.
//
// IMPORTANT — separate quota from the model itself: Google meters
// "Grounding with Google Search" (the `google_search` tool) on its own
// quota, independent of a model's own RPM/TPM/RPD. On the free tier that
// grounding quota is small and shared, so this call can 429 with
// RESOURCE_EXHAUSTED even while the model's own request quota (visible on
// the AI Studio Rate Limit page) shows 0 usage. Swapping GEMINI_MODEL does
// not fix this — it's gated on the tool, not the model. Disabled by
// default (see ENABLE_SEARCH_GROUNDING below); turn it on once billing is
// set up if you want it back.
const ENABLE_SEARCH_GROUNDING = process.env.GEMINI_ENABLE_SEARCH_GROUNDING === "true";

async function identifyFoodViaSearch(
  latestUserMessage: string | undefined,
  apiKey: string,
  model: string
): Promise<string | null> {
  if (!ENABLE_SEARCH_GROUNDING) return null;
  if (!latestUserMessage || !latestUserMessage.trim()) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `A user of a food-logging app wrote this about what they ate (it may be in Hindi/Hinglish, another language, a regional name, a misspelling, or a brand name):

"${latestUserMessage}"

Use Google Search to confirm, for EACH distinct food/dish mentioned:
1. Its standard English name.
2. Its typical real-world ingredients (for a composite dish) — the main ones, with a rough proportion (e.g. "mostly rice, with chicken pieces, some yogurt/spices").
3. A rough typical portion/serving size and its approximate calories, if the message didn't already state a size.

If a food is simple and unambiguous (e.g. "an egg", "a banana"), just confirm it briefly without over-searching. Be concise — a few lines per food, plain text, no markdown headers, no preamble like "Here is what I found".`,
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2 },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const res = await fetchGeminiWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn("[food-chat] Search-grounded identification call failed", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.warn("[food-chat] Search-grounded identification call errored", err);
    return null;
  }
}

// ── Call 2: schema-enforced decision ────────────────────────────────────
async function callGemini(
  messages: ChatMessage[],
  foods: FoodTemplate[],
  recentFoods: RecentFoodTemplate[],
  coach?: CoachContext
): Promise<ChatResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")?.text;

  const groundedIdentification = await identifyFoodViaSearch(latestUserMessage, apiKey, model);

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const body = {
    contents,
    systemInstruction: {
      parts: [{ text: buildSystemPrompt(foods, recentFoods, coach, latestUserMessage, groundedIdentification) }],
    },
    generationConfig: {
      // Lowered from 0.4 — this call is a rule-following classification
      // task (which Case applies, what to credit), not creative writing,
      // and a lower temperature makes it follow the Case 1/2/3 + dietCoverageCheck
      // instructions more consistently turn over turn.
      temperature: 0.15,
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
    console.error("Gemini request failed", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();
  if (!raw) return null;

  // responseSchema guarantees valid JSON in the vast majority of cases, but
  // parseModelJson's fence-stripping/brace-matching costs nothing and is
  // cheap insurance against the rare case the model still wraps it.
  const parsed = parseModelJson(raw);
  if (!parsed) {
    console.warn("[food-chat] Could not parse JSON out of the model's response:", raw);
    return null;
  }
  return parsed;
}

// Belt-and-suspenders: even with responseSchema, occasionally strips a
// stray ```json fence or leading/trailing text the model added anyway,
// then falls back to grabbing the first balanced {...} block.
function parseModelJson(raw: string): ChatResult | null {
  const fenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(fenced) as ChatResult;
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
          return JSON.parse(fenced.slice(start, i + 1)) as ChatResult;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Used only when no GEMINI_API_KEY is configured — a single-shot heuristic
// match against the user's Diet, no conversation, no dish decomposition,
// no Recent Foods creation (that genuinely needs an LLM to estimate
// nutrition for an unknown dish).
function localFallback(
  messages: ChatMessage[],
  foods: FoodTemplate[],
  coach?: CoachContext
): ChatResult {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";
  const matches = parseFoodEntry(lastUser, foods);

  if (matches.length === 0) {
    // No Diet match — without Gemini we can't reason about ingredients or
    // ask clarifying questions, but we can still recognize known dishes via
    // the Master Food Database and log them into Recent Foods with real
    // nutrition figures, instead of giving up entirely. This won't credit
    // any Diet item's ingredients (e.g. an omelette won't also credit
    // "Eggs") since that decomposition genuinely needs an LLM — only the
    // dish itself gets logged.
    const dbMatch = findBestMasterFoodMatch(lastUser);
    if (dbMatch) {
      return {
        reply: `Logged ${dbMatch.name} (from the reference database) into Recent Foods. Add a free Gemini API key (GEMINI_API_KEY) so dishes like this can also credit matching Diet ingredients automatically.`,
        done: true,
        actions: [
          {
            type: "log_recent" as const,
            name: dbMatch.name,
            unit: "serving",
            kind: "binary",
            targetQuantity: 1,
            quantityConsumedRecent: 1,
            calories: dbMatch.calories,
            protein: dbMatch.protein,
            carbs: dbMatch.carbs,
            fats: dbMatch.fat,
            category: "other",
            baseIngredient: dbMatch.name.toLowerCase(),
            aliases: dbMatch.aliases.slice(0, 3),
          },
        ],
      };
    }

    return {
      reply:
        "I couldn't match that to your Diet or the reference database, and logging new/composite dishes into Recent Foods needs a free Gemini API key set up (GEMINI_API_KEY). You can log it manually from the Recent Foods tab for now.",
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
    reply: `Logged ${matches.length} Diet item${matches.length > 1 ? "s" : ""}.${nudge} Add a free Gemini API key (GEMINI_API_KEY) to log new/composite dishes into Recent Foods automatically.`,
    done: true,
    actions: matches.map((m) => ({
      type: "log_diet" as const,
      foodId: m.foodId,
      quantityConsumed: m.addedQuantity,
    })),
  };
}

export async function POST(req: NextRequest) {
  const { messages, foods, recentFoods, coach } = (await req.json()) as {
    messages: ChatMessage[];
    foods: FoodTemplate[];
    recentFoods?: RecentFoodTemplate[];
    coach?: CoachContext;
  };

  if (!messages || messages.length === 0) {
    return NextResponse.json({ reply: "What did you eat?", done: false, actions: [] });
  }

  const gemini = await callGemini(messages, foods, recentFoods ?? [], coach);
  if (gemini) return NextResponse.json(validateChatResult(gemini, foods));

  return NextResponse.json(localFallback(messages, foods, coach));
}
