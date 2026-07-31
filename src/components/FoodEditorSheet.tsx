"use client";

import { useEffect, useState } from "react";
import { Sheet } from "./ui/sheet";
import { Button } from "./ui/button";
import { useStore } from "@/lib/store";
import { FoodTemplate, Unit, FoodKind, FoodCategory } from "@/lib/types";
import { FOOD_ICON_OPTIONS, CATEGORY_ICON_KEYS, AppIcon, FoodIcon, getCategoryStyle } from "@/lib/icons";
import { Database } from "lucide-react";

const UNIT_OPTIONS: Unit[] = ["g", "ml", "count", "serving"];
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const CATEGORY_OPTIONS: { value: FoodCategory; label: string }[] = [
  { value: "protein", label: "Protein" },
  { value: "grain", label: "Carbs/Grain" },
  { value: "vegetable", label: "Vegetable" },
  { value: "fruit", label: "Fruit" },
  { value: "dairy", label: "Dairy" },
  { value: "fat", label: "Fats/Nuts" },
  { value: "other", label: "Other" },
  { value: "custom", label: "Custom" },
];

const emptyBase: Omit<FoodTemplate, "id" | "sortOrder"> = {
  name: "",
  emoji: "Egg",
  targetQuantity: 1,
  unit: "count",
  calories: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
  aliases: [],
  archived: false,
  category: "other",
  customCategory: "",
  baseIngredient: "",
  kind: "quantity",
  activeDays: ALL_DAYS,
  dateOnly: null, // Diet items are always recurring — a one-off belongs in Recent Foods instead
};

export function FoodEditorSheet({
  food,
  initial,
  open,
  onClose,
}: {
  food: FoodTemplate | null;
  // Optional prefill (from the master database picker) used only when
  // creating a brand-new food. Every value here is just a starting point —
  // the user can change anything before saving, and what gets saved is
  // always their own food, never a write to the master database.
  initial?: Partial<FoodTemplate> | null;
  open: boolean;
  onClose: () => void;
}) {
  const { addFood, updateFood } = useStore();
  const [form, setForm] = useState(emptyBase);

  useEffect(() => {
    if (food) {
      setForm(food);
    } else {
      // Diet items are always recurring — a one-off belongs in Recent
      // Foods instead, not here.
      setForm({ ...emptyBase, ...(initial ?? {}), activeDays: ALL_DAYS, dateOnly: null });
    }
  }, [food, initial, open]);

  function save() {
    if (!form.name.trim()) return;
    if (food) {
      updateFood(food.id, form);
    } else {
      addFood(form);
    }
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={food ? "Edit food" : "Add food"}>
      <div className="space-y-4">
        {!food && initial && (
          <div className="flex items-start gap-2 rounded-xl bg-nova-500/10 px-3 py-2.5 text-xs text-[var(--text-muted)]">
            <Database className="w-3.5 h-3.5 mt-0.5 shrink-0 text-nova-500" />
            <span>
              Values pulled from the food database — change anything you like. It&apos;ll save just for you, not the
              shared database.
            </span>
          </div>
        )}
        <div>
          <span className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Icon</span>
          <div className="flex gap-2 flex-wrap">
            {FOOD_ICON_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                title={opt.label}
                aria-label={opt.label}
                onClick={() => setForm((f) => ({ ...f, emoji: opt.key }))}
                className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-colors ${
                  form.emoji === opt.key
                    ? "border-nova-500 ring-2 ring-offset-2 ring-offset-[var(--bg-elevated)] ring-nova-500"
                    : "border-[var(--border)]"
                }`}
              >
                <FoodIcon iconKey={opt.key} category={form.category} size="lg" />
              </button>
            ))}
          </div>
        </div>

        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Chicken, Rice, Almonds"
            className="input"
          />
        </Field>

        <div>
          <span className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Category</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_OPTIONS.map((c) => {
              const style = getCategoryStyle(c.value);
              const selected = form.category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selected
                      ? `${style.chipBg} ${style.chipText} ring-1 ring-inset ${style.ring}`
                      : "border border-[var(--border)] text-[var(--text-muted)]"
                  }`}
                >
                  <AppIcon
                    name={CATEGORY_ICON_KEYS[c.value]}
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    fillOpacity={selected ? 0.25 : 0}
                    strokeWidth={1.75}
                  />{" "}
                  {c.label}
                </button>
              );
            })}
          </div>
          {form.category === "custom" && (
            <input
              value={form.customCategory ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, customCategory: e.target.value }))}
              placeholder="Name your category, e.g. Snacks, Supplements"
              className="input mt-2"
              autoFocus
            />
          )}
        </div>

        <Field label="Base ingredient (optional — helps the AI recognize it across different dishes)">
          <input
            value={form.baseIngredient}
            onChange={(e) => setForm((f) => ({ ...f, baseIngredient: e.target.value }))}
            placeholder="e.g. rice, chicken, banana"
            className="input"
          />
        </Field>

        <div className="flex gap-2">
          <button
            onClick={() => setForm((f) => ({ ...f, kind: "binary" as FoodKind, unit: "serving", targetQuantity: 1 }))}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
              form.kind === "binary" ? "bg-nova-700 text-white border-nova-700" : "border-[var(--border)]"
            }`}
          >
            One tap (binary)
          </button>
          <button
            onClick={() => setForm((f) => ({ ...f, kind: "quantity" as FoodKind, unit: "g" }))}
            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
              form.kind === "quantity" ? "bg-nova-700 text-white border-nova-700" : "border-[var(--border)]"
            }`}
          >
            Track amount
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target quantity">
            <input
              type="number"
              value={form.targetQuantity}
              onChange={(e) => setForm((f) => ({ ...f, targetQuantity: Number(e.target.value) }))}
              className="input"
            />
          </Field>
          <Field label="Unit">
            <select
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as Unit }))}
              className="input"
              disabled={form.kind === "binary"}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="text-xs text-[var(--text-muted)] -mt-2">
          Nutrition is per {form.kind === "binary" || form.unit === "serving" ? "full serving" : `1 ${form.unit === "count" ? "item" : form.unit}`}.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories">
            <input
              type="number"
              value={form.calories}
              onChange={(e) => setForm((f) => ({ ...f, calories: Number(e.target.value) }))}
              className="input"
            />
          </Field>
          <Field label="Protein (g)">
            <input
              type="number"
              value={form.protein}
              onChange={(e) => setForm((f) => ({ ...f, protein: Number(e.target.value) }))}
              className="input"
            />
          </Field>
          <Field label="Carbs (g)">
            <input
              type="number"
              value={form.carbs}
              onChange={(e) => setForm((f) => ({ ...f, carbs: Number(e.target.value) }))}
              className="input"
            />
          </Field>
          <Field label="Fats (g)">
            <input
              type="number"
              value={form.fats}
              onChange={(e) => setForm((f) => ({ ...f, fats: Number(e.target.value) }))}
              className="input"
            />
          </Field>
        </div>

        <Field label="Aliases (comma separated, helps AI logging)">
          <input
            value={form.aliases.join(", ")}
            onChange={(e) =>
              setForm((f) => ({ ...f, aliases: e.target.value.split(",").map((a) => a.trim()).filter(Boolean) }))
            }
            placeholder="e.g. whey, shake"
            className="input"
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="block text-xs font-medium text-[var(--text-muted)]">Days it appears</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, dateOnly: null, activeDays: ALL_DAYS }))}
                className="text-[11px] font-medium text-nova-400"
              >
                Every day
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, dateOnly: null, activeDays: [1, 2, 3, 4, 5] }))}
                className="text-[11px] font-medium text-nova-400"
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, dateOnly: null, activeDays: [0, 6] }))}
                className="text-[11px] font-medium text-nova-400"
              >
                Weekends
              </button>
            </div>
          </div>

          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, i) => {
              const selected = form.activeDays.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  title={DAY_FULL[i]}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      activeDays: selected ? f.activeDays.filter((d) => d !== i) : [...f.activeDays, i].sort(),
                    }))
                  }
                  className={`h-9 flex-1 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                    selected ? "bg-nova-600 text-white shadow-glow-nova" : "border border-[var(--border)] text-[var(--text-muted)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {form.activeDays.length === 0 && (
            <p className="text-[11px] text-ember-400 mt-1.5">Pick at least one day, or it will never show up.</p>
          )}
        </div>

        <Button className="w-full" size="lg" onClick={save} disabled={form.activeDays.length === 0}>
          {food ? "Save changes" : "Add food"}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[var(--text-muted)] mb-1">{label}</span>
      {children}
    </label>
  );
}
