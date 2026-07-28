"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "./ui/sheet";
import { Button } from "./ui/button";
import { EditableNumber } from "./ui/editable-number";
import { useStore } from "@/lib/store";
import { MealCombo, MealComboItem } from "@/lib/types";
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

export function ComboEditorSheet({
  combo,
  open,
  onClose,
}: {
  combo: MealCombo | null;
  open: boolean;
  onClose: () => void;
}) {
  const { foods, addCombo, updateCombo } = useStore();
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (combo) {
      setForm({ name: combo.name, icon: combo.icon, items: combo.items });
    } else {
      setForm(empty);
    }
    setSearch("");
  }, [combo, open]);

  const activeFoods = useMemo(() => foods.filter((f) => !f.archived), [foods]);
  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeFoods;
    return activeFoods.filter((f) => f.name.toLowerCase().includes(q));
  }, [activeFoods, search]);

  function itemFor(foodId: string): MealComboItem | undefined {
    return form.items.find((i) => i.foodId === foodId);
  }

  function toggleFood(foodId: string) {
    const food = foods.find((f) => f.id === foodId);
    if (!food) return;
    setForm((f) => {
      const exists = f.items.some((i) => i.foodId === foodId);
      if (exists) {
        return { ...f, items: f.items.filter((i) => i.foodId !== foodId) };
      }
      const defaultQty = food.kind === "binary" ? food.targetQuantity : food.targetQuantity || 1;
      return { ...f, items: [...f.items, { foodId, quantity: defaultQty }] };
    });
  }

  function setQuantity(foodId: string, quantity: number) {
    setForm((f) => ({
      ...f,
      items: f.items.map((i) => (i.foodId === foodId ? { ...i, quantity: Math.max(0, quantity) } : i)),
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
                className={`rounded-xl transition-shadow ${
                  form.icon === opt.key ? "ring-2 ring-offset-2 ring-offset-[var(--bg-elevated)] ring-nova-500" : ""
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
                const food = foods.find((f) => f.id === item.foodId);
                if (!food) return null;
                return (
                  <div
                    key={item.foodId}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
                  >
                    <FoodIcon iconKey={food.emoji} category={food.category} size="sm" />
                    <span className="flex-1 text-sm font-medium truncate">{food.name}</span>
                    {food.kind === "binary" ? (
                      <span className="text-xs text-[var(--text-muted)]">1 tap</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuantity(item.foodId, item.quantity - (food.unit === "count" ? 1 : 50))}
                          className="h-7 w-7 flex items-center justify-center rounded-full bg-nova-700/8 dark:bg-nova-100/10"
                          aria-label={`Decrease ${food.name}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs tabular-nums w-14 flex items-center justify-center">
                          <EditableNumber
                            value={item.quantity}
                            onChange={(v) => setQuantity(item.foodId, Math.max(0, v))}
                            ariaLabel={`${food.name} quantity`}
                            className="w-9 bg-transparent"
                          />
                          {food.unit === "count" ? "" : food.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(item.foodId, item.quantity + (food.unit === "count" ? 1 : 50))}
                          className="h-7 w-7 flex items-center justify-center rounded-full bg-nova-700/8 dark:bg-nova-100/10"
                          aria-label={`Increase ${food.name}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleFood(item.foodId)}
                      className="h-7 w-7 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-ember-600/10 hover:text-ember-600"
                      aria-label={`Remove ${food.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your foods…"
              className="input pl-8"
            />
          </div>

          <div className="max-h-52 overflow-y-auto no-scrollbar space-y-1.5">
            {filteredFoods.map((food) => {
              const selected = !!itemFor(food.id);
              const style = getCategoryStyle(food.category);
              return (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => toggleFood(food.id)}
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
            {filteredFoods.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">
                No foods match. Add foods in the Foods tab first.
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
