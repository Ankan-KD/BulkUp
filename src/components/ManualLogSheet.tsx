"use client";

import { useMemo, useState } from "react";
import { Sheet } from "./ui/sheet";
import { Button } from "./ui/button";
import { FoodIcon, resolveFoodIconKey, getCategoryStyle } from "@/lib/icons";
import { searchMasterFoods, mapMasterCategory, masterFoodToDietPrefill, MasterFoodEntry } from "@/lib/masterFoods";
import { useStore } from "@/lib/store";
import { FoodCategory, FoodKind, FoodTemplate, RecentFoodTemplate, Unit } from "@/lib/types";
import { Loader2, Search, Sparkles, Wand2 } from "lucide-react";

// A blank, fully-editable draft — same shape whether it started from the
// Master Food Database, an AI estimate, or nothing at all.
interface Draft {
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

const BLANK_DRAFT = (name = ""): Draft => ({
  name,
  category: "other",
  customCategory: "",
  emoji: "Utensils",
  unit: "serving",
  kind: "binary",
  targetQuantity: 1,
  calories: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
  aliases: [],
  baseIngredient: name.toLowerCase(),
});

const UNIT_OPTIONS: Unit[] = ["g", "ml", "count", "serving", "oz"];

function matchesQuery(name: string, aliases: string[], q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  return name.toLowerCase().includes(needle) || aliases.some((a) => a.toLowerCase().includes(needle));
}

/**
 * Manual food logging for Today's Consumption — the alternative to
 * describing what you ate to the AI in QuickLogSheet. Uses the exact same
 * Master Food Database search as "Add to Diet" (DietFoodPickerSheet), plus:
 *  - checks the user's own Diet and Recent Foods catalogs first, so logging
 *    something you already track just bumps its progress instead of
 *    creating a duplicate entry;
 *  - falls back to a single AI-estimated lookup (/api/food-lookup) when the
 *    food isn't in the local dataset, prefilling nutrition that's still
 *    fully editable before saving.
 */
export function ManualLogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { foods, recentFoods, logQuantity, addQuantity, toggleBinary, logRecentFood } = useStore();

  const [query, setQuery] = useState("");
  const [step, setStep] = useState<"search" | "confirm">("search");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // What we're about to log — either an existing Diet item (bump its
  // progress) or a Recent Foods entry (existing catalog id, or a brand new
  // draft to create).
  const [dietTarget, setDietTarget] = useState<FoodTemplate | null>(null);
  const [recentTarget, setRecentTarget] = useState<RecentFoodTemplate | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [quantity, setQuantity] = useState(1);

  const dietMatches = useMemo(
    () => (query.trim().length >= 2 ? foods.filter((f) => !f.archived && matchesQuery(f.name, f.aliases, query)).slice(0, 6) : []),
    [foods, query]
  );
  const recentMatches = useMemo(
    () => (query.trim().length >= 2 ? recentFoods.filter((f) => matchesQuery(f.name, f.aliases, query)).slice(0, 6) : []),
    [recentFoods, query]
  );
  const dbResults = useMemo(() => searchMasterFoods(query, 20), [query]);

  function reset() {
    setQuery("");
    setStep("search");
    setAiError(null);
    setAiLoading(false);
    setDietTarget(null);
    setRecentTarget(null);
    setDraft(null);
    setQuantity(1);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickDiet(food: FoodTemplate) {
    setDietTarget(food);
    setRecentTarget(null);
    setDraft(null);
    setQuantity(food.kind === "binary" ? food.targetQuantity : food.targetQuantity);
    setStep("confirm");
  }

  function pickRecent(food: RecentFoodTemplate) {
    setRecentTarget(food);
    setDietTarget(null);
    setDraft(null);
    setQuantity(food.targetQuantity);
    setStep("confirm");
  }

  function pickDbEntry(entry: MasterFoodEntry) {
    const prefill = masterFoodToDietPrefill(entry);
    setDraft(prefill);
    setDietTarget(null);
    setRecentTarget(null);
    setQuantity(prefill.targetQuantity);
    setStep("confirm");
  }

  function pickManual() {
    setDraft(BLANK_DRAFT(query.trim()));
    setDietTarget(null);
    setRecentTarget(null);
    setQuantity(1);
    setStep("confirm");
  }

  async function pickAiEstimate() {
    const name = query.trim();
    if (!name) return;
    setAiError(null);
    setAiLoading(true);
    try {
      const res = await fetch("/api/food-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || "Couldn't estimate that food — try entering it manually.");
        return;
      }
      const d: Draft = {
        name: data.name,
        category: data.category,
        customCategory: data.customCategory ?? "",
        emoji: data.emoji,
        unit: data.unit,
        kind: data.kind,
        targetQuantity: data.targetQuantity,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        aliases: data.aliases ?? [],
        baseIngredient: data.baseIngredient,
      };
      setDraft(d);
      setDietTarget(null);
      setRecentTarget(null);
      setQuantity(d.targetQuantity);
      setStep("confirm");
    } catch {
      setAiError("Couldn't reach the AI estimator — try entering it manually.");
    } finally {
      setAiLoading(false);
    }
  }

  async function confirmLog() {
    setSaving(true);
    try {
      if (dietTarget) {
        if (dietTarget.kind === "binary") {
          toggleBinary(dietTarget.id);
        } else {
          addQuantity(dietTarget.id, quantity);
        }
        handleClose();
        return;
      }

      if (recentTarget) {
        await logRecentFood({ recentFoodId: recentTarget.id, quantity });
        handleClose();
        return;
      }

      if (draft) {
        // If the manually-entered/AI-estimated name happens to match a
        // Diet item exactly (by name/alias), credit that instead of
        // silently creating a duplicate Recent Foods entry — same logic
        // the AI chat flow (Case 1) uses.
        const dietMatch = foods.find(
          (f) =>
            !f.archived &&
            (f.name.trim().toLowerCase() === draft.name.trim().toLowerCase() ||
              f.aliases.some((a) => a.trim().toLowerCase() === draft.name.trim().toLowerCase()))
        );
        if (dietMatch) {
          if (dietMatch.kind === "binary") {
            toggleBinary(dietMatch.id);
          } else {
            addQuantity(dietMatch.id, quantity);
          }
          handleClose();
          return;
        }

        const template: Omit<RecentFoodTemplate, "id" | "createdAt"> = {
          name: draft.name || "Food",
          emoji: resolveFoodIconKey(draft.emoji, draft.category),
          targetQuantity: draft.targetQuantity || 1,
          unit: draft.unit,
          kind: draft.kind,
          calories: draft.calories,
          protein: draft.protein,
          carbs: draft.carbs,
          fats: draft.fats,
          aliases: draft.aliases,
          category: draft.category,
          customCategory: draft.customCategory,
          baseIngredient: draft.baseIngredient || draft.name.toLowerCase(),
        };
        await logRecentFood({ template, quantity });
        handleClose();
      }
    } finally {
      setSaving(false);
    }
  }

  const confirmName = dietTarget?.name ?? recentTarget?.name ?? draft?.name ?? "";
  const confirmCategory = dietTarget?.category ?? recentTarget?.category ?? draft?.category ?? "other";
  const confirmEmoji = dietTarget?.emoji ?? recentTarget?.emoji ?? draft?.emoji ?? "Utensils";
  const confirmUnit = dietTarget?.unit ?? recentTarget?.unit ?? draft?.unit ?? "serving";
  const confirmKind = dietTarget?.kind ?? recentTarget?.kind ?? draft?.kind ?? "binary";
  const editable = !!draft; // Diet/Recent matches reuse their own stored nutrition; only a fresh draft's numbers are editable here.

  return (
    <Sheet open={open} onClose={handleClose} title={step === "search" ? "Log manually" : "Confirm & log"}>
      {step === "search" ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search e.g. Chicken Breast, Rice, Banana"
              className="w-full border border-[var(--border)] bg-[var(--bg)] rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-nova-500"
            />
          </div>

          <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 space-y-3">
            {(dietMatches.length > 0 || recentMatches.length > 0) && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide px-0.5">
                  Already in your foods
                </p>
                {dietMatches.map((food) => (
                  <button
                    key={`diet-${food.id}`}
                    type="button"
                    onClick={() => pickDiet(food)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border)] hover:bg-nova-500/8 text-left transition-colors"
                  >
                    <FoodIcon iconKey={food.emoji} category={food.category} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{food.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">In your Diet</p>
                    </div>
                  </button>
                ))}
                {recentMatches.map((food) => (
                  <button
                    key={`recent-${food.id}`}
                    type="button"
                    onClick={() => pickRecent(food)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border)] hover:bg-nova-500/8 text-left transition-colors"
                  >
                    <FoodIcon iconKey={food.emoji} category={food.category} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{food.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">Logged before</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {dbResults.length > 0 && (
                <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide px-0.5">
                  Reference database
                </p>
              )}
              {dbResults.map((entry) => {
                const { category } = mapMasterCategory(entry);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => pickDbEntry(entry)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border)] hover:bg-nova-500/8 text-left transition-colors"
                  >
                    <FoodIcon category={category} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {Math.round(entry.calories)} kcal per {entry.servingSize ?? 100} {entry.servingUnit} ·{" "}
                        {entry.subcategory}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {query.trim().length >= 2 && dbResults.length === 0 && dietMatches.length === 0 && recentMatches.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] text-center py-4">
                No matches for &quot;{query}&quot; in the database.
              </p>
            )}
            {query.trim().length < 2 && (
              <p className="text-xs text-[var(--text-muted)] text-center py-6">
                Start typing to search your foods and thousands of reference items.
              </p>
            )}
          </div>

          {query.trim().length >= 2 && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={pickAiEstimate}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-nova-500/50 text-sm font-medium text-nova-500 hover:bg-nova-500/8 transition-colors disabled:opacity-60"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Estimating with AI…
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" /> Can&apos;t find it? Let AI estimate the values
                  </>
                )}
              </button>
              {aiError && <p className="text-xs text-ember-500 text-center">{aiError}</p>}
              <button
                type="button"
                onClick={pickManual}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-nova-500/8 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> Enter the values myself
              </button>
            </div>
          )}
        </div>
      ) : (
        <ConfirmForm
          name={confirmName}
          category={confirmCategory}
          emoji={confirmEmoji}
          unit={confirmUnit}
          kind={confirmKind}
          quantity={quantity}
          setQuantity={setQuantity}
          editable={editable}
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          onBack={() => setStep("search")}
          onConfirm={confirmLog}
        />
      )}
    </Sheet>
  );
}

function ConfirmForm({
  name,
  category,
  emoji,
  unit,
  kind,
  quantity,
  setQuantity,
  editable,
  draft,
  setDraft,
  saving,
  onBack,
  onConfirm,
}: {
  name: string;
  category: FoodCategory;
  emoji: string;
  unit: Unit;
  kind: FoodKind;
  quantity: number;
  setQuantity: (n: number) => void;
  editable: boolean;
  draft: Draft | null;
  setDraft: (d: Draft) => void;
  saving: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const style = getCategoryStyle(category);

  function patch(p: Partial<Draft>) {
    if (draft) setDraft({ ...draft, ...p });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FoodIcon iconKey={emoji} category={category} size="lg" />
        <div className="flex-1 min-w-0">
          {editable ? (
            <input
              value={name}
              onChange={(e) => patch({ name: e.target.value })}
              className="w-full text-[15px] font-medium bg-transparent border-b border-[var(--border)] focus:outline-none focus:border-nova-500 pb-0.5"
              placeholder="Food name"
            />
          ) : (
            <p className="text-[15px] font-medium truncate">{name}</p>
          )}
          <p className={`text-[11px] mt-0.5 ${style.chipText}`}>{category === "custom" ? "Custom" : category}</p>
        </div>
      </div>

      <div>
        <label className="text-xs text-[var(--text-muted)] mb-1 block">
          {kind === "binary" ? "Quantity (servings)" : `Quantity (${unit})`}
        </label>
        <input
          type="number"
          min={0}
          step={kind === "binary" ? 1 : unit === "count" ? 1 : 5}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
          className="w-full border border-[var(--border)] bg-[var(--bg)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-nova-500"
        />
      </div>

      {editable && draft && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Unit</label>
              <select
                value={draft.unit}
                onChange={(e) => patch({ unit: e.target.value as Unit })}
                className="w-full border border-[var(--border)] bg-[var(--bg)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-nova-500"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Target qty</label>
              <input
                type="number"
                min={0}
                value={draft.targetQuantity}
                onChange={(e) => patch({ targetQuantity: Number(e.target.value) || 0 })}
                className="w-full border border-[var(--border)] bg-[var(--bg)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-nova-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumField label="Calories" value={draft.calories} onChange={(v) => patch({ calories: v })} />
            <NumField label="Protein (g)" value={draft.protein} onChange={(v) => patch({ protein: v })} />
            <NumField label="Carbs (g)" value={draft.carbs} onChange={(v) => patch({ carbs: v })} />
            <NumField label="Fats (g)" value={draft.fats} onChange={(v) => patch({ fats: v })} />
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Nutrition values are per {kind === "binary" || draft.unit === "serving" ? "the full quantity above" : `1 ${draft.unit}`}.
          </p>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onConfirm} disabled={saving || !name.trim()} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log it"}
        </Button>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-[var(--text-muted)] mb-1 block">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full border border-[var(--border)] bg-[var(--bg)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-nova-500"
      />
    </div>
  );
}
