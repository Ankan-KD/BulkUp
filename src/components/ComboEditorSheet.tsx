"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "./ui/sheet";
import { Button } from "./ui/button";
import { EditableNumber } from "./ui/editable-number";
import { useStore } from "@/lib/store";
import { FoodTemplate, MealCombo, MealComboItem, RecentFoodTemplate } from "@/lib/types";
import { FoodIcon, AppIcon, getCategoryStyle } from "@/lib/icons";
import { Plus, Minus, X, Search } from "lucide-react";

const COMBO_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "UtensilsCrossed", label: "General meal" },
  { key: "Coffee", label: "Breakfast" },
  { key: "Sandwich", label: "Lunch" },
  { key: "Soup", label: "Dinner" },
  { key: "Popcorn", label: "Snack" },
  { key: "CupSoda", label: "Shake" },
];

const empty: Omit<MealCombo, "id" | "sortOrder"> = {
  name: "",
  icon: "UtensilsCrossed",
  items: [],
};

// A combo item can reference either a Diet food or a Recent Food — this
// resolves either into the common shape the UI needs to render it.
type ResolvedItem = {
  key: string; // foodId or recentFoodId
  source: "diet" | "recent";
  name: string;
  emoji: string;
  category: FoodTemplate["category"];
  unit: FoodTemplate["unit"];
  kind: FoodTemplate["kind"];
};

export function ComboEditorSheet({
  combo,
  open,
  onClose,
}: {
  combo: MealCombo | null;
  open: boolean;
  onClose: () => void;
}) {
  const { foods, recentFoods, addCombo, updateCombo } = useStore();
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  // Which catalog the picker below is showing — per the redesign, a combo
  // can pull from either the Diet or Recent Foods, but never owns either.
  const [pickerSource, setPickerSource] = useState<"diet" | "recent">("diet");

  useEffect(() => {
    if (combo) {
      setForm({ name: combo.name, icon: combo.icon, items: combo.items });
    } else {
      setForm(empty);
    }
    setSearch("");
    setPickerSource("diet");
  }, [combo, open]);

  const activeFoods = useMemo(() => foods.filter((f) => !f.archived), [foods]);
  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeFoods;
    return activeFoods.filter((f) => f.name.toLowerCase().includes(q));
  }, [activeFoods, search]);
  const filteredRecent = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recentFoods;
    return recentFoods.filter((f) => f.name.toLowerCase().includes(q));
  }, [recentFoods, search]);

  function resolve(item: MealComboItem): ResolvedItem | null {
    if (item.foodId) {
      const f = foods.find((x) => x.id === item.foodId);
      if (!f) return null;
      return { key: f.id, source: "diet", name: f.name, emoji: f.emoji, category: f.category, unit: f.unit, kind: f.kind };
    }
    if (item.recentFoodId) {
      const f = recentFoods.find((x) => x.id === item.recentFoodId);
      if (!f) return null;
      return { key: f.id, source: "recent", name: f.name, emoji: f.emoji, category: f.category, unit: f.unit, kind: f.kind };
    }
    return null;
  }

  function isSelected(source: "diet" | "recent", id: string) {
    return form.items.some((i) => (source === "diet" ? i.foodId === id : i.recentFoodId === id));
  }

  function toggleDietFood(food: FoodTemplate) {
    setForm((f) => {
      if (isSelected("diet", food.id)) {
        return { ...f, items: f.items.filter((i) => i.foodId !== food.id) };
      }
      const defaultQty = food.kind === "binary" ? food.targetQuantity : food.targetQuantity || 1;
      return { ...f, items: [...f.items, { foodId: food.id, quantity: defaultQty }] };
    });
  }

  function toggleRecentFood(food: RecentFoodTemplate) {
    setForm((f) => {
      if (isSelected("recent", food.id)) {
        return { ...f, items: f.items.filter((i) => i.recentFoodId !== food.id) };
      }
      const defaultQty = food.kind === "binary" ? food.targetQuantity : food.targetQuantity || 1;
      return { ...f, items: [...f.items, { recentFoodId: food.id, quantity: defaultQty }] };
    });
  }

  function setQuantity(source: "diet" | "recent", id: string, quantity: number) {
    setForm((f) => ({
      ...f,
      items: f.items.map((i) =>
        (source === "diet" ? i.foodId === id : i.recentFoodId === id) ? { ...i, quantity: Math.max(0, quantity) } : i
      ),
    }));
  }

  function removeItem(source: "diet" | "recent", id: string) {
    setForm((f) => ({
      ...f,
      items: f.items.filter((i) => (source === "diet" ? i.foodId !== id : i.recentFoodId !== id)),
    }));
  }

  function save() {
    if (!form.name.trim() || form.items.length === 0) return;
    if (combo) {
      updateCombo(combo.id, form);
    } else {
      addCombo(form);
    }
    onClose();
  }

  const pickerList = pickerSource === "diet" ? filteredFoods : filteredRecent;

  return (
    <Sheet open={open} onClose={onClose} title={combo ? "Edit combo" : "New combo"}>
      <div className="space-y-4">
        <div>
          <span className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Icon</span>
          <div className="flex gap-2 flex-wrap">
            {COMBO_ICON_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                title={opt.label}
                aria-label={opt.label}
                onClick={() => setForm((f) => ({ ...f, icon: opt.key }))}
                className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-colors ${
                  form.icon === opt.key
                    ? "border-nova-500 ring-2 ring-offset-2 ring-offset-[var(--bg-elevated)] ring-nova-500"
                    : "border-[var(--border)]"
                }`}
              >
                <FoodIcon iconKey={opt.key} size="lg" />
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Breakfast, Post-workout"
            className="input"
          />
        </label>

        <div>
          <span className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
            Foods in this combo {form.items.length > 0 && `(${form.items.length})`}
          </span>

          {form.items.length > 0 && (
            <div className="space-y-2 mb-3">
              {form.items.map((item) => {
                const resolved = resolve(item);
                if (!resolved) return null;
                return (
                  <div
                    key={`${resolved.source}:${resolved.key}`}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
                  >
                    <FoodIcon iconKey={resolved.emoji} category={resolved.category} size="sm" />
                    <span className="flex-1 text-sm font-medium truncate">
                      {resolved.name}
                      {resolved.source === "recent" && (
                        <span className="ml-1.5 text-[10px] font-normal text-[var(--text-muted)] align-middle">Recent</span>
                      )}
                    </span>
                    {resolved.kind === "binary" ? (
                      <span className="text-xs text-[var(--text-muted)]">1 tap</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(resolved.source, resolved.key, item.quantity - (resolved.unit === "count" ? 1 : 50))
                          }
                          className="h-7 w-7 flex items-center justify-center rounded-full bg-nova-700/8 dark:bg-nova-100/10"
                          aria-label={`Decrease ${resolved.name}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs tabular-nums w-14 flex items-center justify-center">
                          <EditableNumber
                            value={item.quantity}
                            onChange={(v) => setQuantity(resolved.source, resolved.key, Math.max(0, v))}
                            ariaLabel={`${resolved.name} quantity`}
                            className="w-9 bg-transparent"
                          />
                          {resolved.unit === "count" ? "" : resolved.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(resolved.source, resolved.key, item.quantity + (resolved.unit === "count" ? 1 : 50))
                          }
                          className="h-7 w-7 flex items-center justify-center rounded-full bg-nova-700/8 dark:bg-nova-100/10"
                          aria-label={`Increase ${resolved.name}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(resolved.source, resolved.key)}
                      className="h-7 w-7 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-ember-600/10 hover:text-ember-600"
                      aria-label={`Remove ${resolved.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Diet vs Recent Foods source picker — a combo only ever references items from one of these two catalogs, it never owns either. */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl2 bg-nova-700/6 dark:bg-nova-100/6 p-1 mb-2">
            {([
              { key: "diet" as const, label: "Diet" },
              { key: "recent" as const, label: "Recent Foods" },
            ]).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setPickerSource(s.key)}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pickerSource === s.key ? "bg-[var(--bg-elevated)] shadow-soft text-[var(--text)]" : "text-[var(--text-muted)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={pickerSource === "diet" ? "Search your Diet…" : "Search Recent Foods…"}
              className="input pl-8"
            />
          </div>

          <div className="max-h-52 overflow-y-auto no-scrollbar space-y-1.5">
            {pickerList.map((food) => {
              const selected = isSelected(pickerSource, food.id);
              const style = getCategoryStyle(food.category);
              return (
                <button
                  key={food.id}
                  type="button"
                  onClick={() =>
                    pickerSource === "diet" ? toggleDietFood(food as FoodTemplate) : toggleRecentFood(food as RecentFoodTemplate)
                  }
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                    selected
                      ? `${style.chipBg} ring-1 ring-inset ${style.ring}`
                      : "hover:bg-nova-700/6 dark:hover:bg-nova-100/6"
                  }`}
                >
                  <FoodIcon iconKey={food.emoji} category={food.category} size="sm" />
                  <span className="flex-1 text-sm truncate">{food.name}</span>
                  {selected && <AppIcon name="Check" className="w-4 h-4 text-nova-600 dark:text-nova-300" />}
                </button>
              );
            })}
            {pickerList.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">
                {pickerSource === "diet"
                  ? "No foods match. Add foods in the Diet tab first."
                  : "No Recent Foods match yet — they show up here once you've logged something outside your Diet."}
              </p>
            )}
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={save} disabled={!form.name.trim() || form.items.length === 0}>
          {combo ? "Save changes" : "Create combo"}
        </Button>
      </div>
      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid var(--border);
          background: var(--bg);
          border-radius: 0.75rem;
          padding: 0.6rem 0.85rem;
          font-size: 0.9rem;
        }
        .input:focus {
          outline: none;
          border-color: #7c5cf0;
        }
      `}</style>
    </Sheet>
  );
}
