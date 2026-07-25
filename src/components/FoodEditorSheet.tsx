"use client";

import { useEffect, useState } from "react";
import { Sheet } from "./ui/sheet";
import { Button } from "./ui/button";
import { useStore } from "@/lib/store";
import { FoodTemplate, Unit, FoodKind } from "@/lib/types";

const EMOJI_OPTIONS = ["🥚", "🥤", "🍗", "🍚", "🥛", "🥜", "🍌", "🥞", "🧀", "🥑", "🍠", "🫘"];
const UNIT_OPTIONS: Unit[] = ["g", "ml", "count", "serving"];

const empty: Omit<FoodTemplate, "id" | "sortOrder"> = {
  name: "",
  emoji: "🥚",
  targetQuantity: 1,
  unit: "count",
  calories: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
  aliases: [],
  archived: false,
  kind: "quantity",
};

export function FoodEditorSheet({
  food,
  open,
  onClose,
}: {
  food: FoodTemplate | null;
  open: boolean;
  onClose: () => void;
}) {
  const { addFood, updateFood } = useStore();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (food) {
      setForm(food);
    } else {
      setForm(empty);
    }
  }, [food, open]);

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
        <div className="flex gap-2 flex-wrap">
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              onClick={() => setForm((f) => ({ ...f, emoji: e }))}
              className={`h-10 w-10 flex items-center justify-center rounded-xl text-xl transition-colors ${
                form.emoji === e ? "bg-nova-700/15 ring-2 ring-nova-500" : "bg-nova-700/6"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Greek Yogurt"
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

        <Button className="w-full" size="lg" onClick={save}>
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
