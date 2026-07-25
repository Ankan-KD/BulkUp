"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FoodEditorSheet } from "@/components/FoodEditorSheet";
import { FoodTemplate, FoodCategory } from "@/lib/types";
import { Plus, Archive, ArchiveRestore } from "lucide-react";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORY_ORDER: FoodCategory[] = ["protein", "grain", "vegetable", "fruit", "dairy", "fat", "other"];

const CATEGORY_META: Record<FoodCategory, { label: string; emoji: string }> = {
  protein: { label: "Proteins", emoji: "🥩" },
  grain: { label: "Carbohydrates", emoji: "🍚" },
  vegetable: { label: "Vegetables", emoji: "🥦" },
  fruit: { label: "Fruits", emoji: "🍎" },
  dairy: { label: "Dairy", emoji: "🥛" },
  fat: { label: "Fats & Nuts", emoji: "🥜" },
  other: { label: "Other", emoji: "🍽️" },
};

function describeDays(days: number[]): string {
  if (!days || days.length === 7) return "Every day";
  if (days.length === 0) return "Never shown";
  const sorted = [...days].sort();
  if (sorted.join(",") === "1,2,3,4,5") return "Weekdays";
  if (sorted.join(",") === "0,6") return "Weekends";
  return sorted.map((d) => DAY_ABBR[d]).join(", ");
}

export default function FoodsPage() {
  const { foods, archiveFood, updateFood } = useStore();
  const [editing, setEditing] = useState<FoodTemplate | null | "new">(null);

  const active = useMemo(
    () => foods.filter((f) => !f.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [foods]
  );
  const archived = useMemo(() => foods.filter((f) => f.archived), [foods]);

  const grouped = useMemo(() => {
    const map = new Map<FoodCategory, FoodTemplate[]>();
    for (const f of active) {
      const cat = f.category || "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(f);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
  }, [active]);

  function unarchiveFood(id: string) {
    updateFood(id, { archived: false });
  }

  return (
    <div className="px-5 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-muted)]">Your ingredients</p>
          <h1 className="font-display text-2xl font-semibold">Foods</h1>
        </div>
        <Button size="icon" onClick={() => setEditing("new")} aria-label="Add food">
          <Plus className="w-5 h-5" />
        </Button>
      </header>

      <div className="space-y-6">
        {grouped.map(({ category, items }) => (
          <section key={category}>
            <div className="flex items-center gap-2 mb-2.5 px-0.5">
              <span className="text-lg">{CATEGORY_META[category].emoji}</span>
              <h2 className="font-display text-[15px] font-semibold">{CATEGORY_META[category].label}</h2>
              <span className="text-xs text-[var(--text-muted)]">({items.length})</span>
            </div>
            <div className="space-y-2.5">
              {items.map((food) => (
                <Card key={food.id} className="p-4 flex items-center gap-3">
                  <span className="text-2xl">{food.emoji}</span>
                  <button className="flex-1 text-left" onClick={() => setEditing(food)}>
                    <p className="font-medium text-[15px]">{food.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Target: {food.targetQuantity} {food.unit === "serving" ? "serving" : food.unit} · {Math.round(
                        food.kind === "binary" ? food.calories : food.calories * food.targetQuantity
                      )} kcal
                    </p>
                    <p className="text-[11px] text-nova-400 mt-0.5">{describeDays(food.activeDays)}</p>
                  </button>
                  <button
                    onClick={() => archiveFood(food.id)}
                    className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-nova-700/8 dark:hover:bg-nova-100/8"
                    aria-label={`Archive ${food.name}`}
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {active.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-3xl mb-2">🌱</p>
            <p className="text-sm text-[var(--text-muted)]">
              Add the ingredients you eat regularly to build your daily checklist.
            </p>
          </Card>
        )}
      </div>

      {archived.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Archived
          </h2>
          <div className="space-y-2">
            {archived.map((food) => (
              <Card key={food.id} className="p-3 flex items-center gap-3 opacity-70">
                <span className="text-lg">{food.emoji}</span>
                <p className="flex-1 text-sm">{food.name}</p>
                <button
                  onClick={() => unarchiveFood(food.id)}
                  className="h-8 w-8 flex items-center justify-center rounded-full text-nova-400 hover:bg-nova-700/12"
                  aria-label={`Restore ${food.name}`}
                >
                  <ArchiveRestore className="w-4 h-4" />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      <FoodEditorSheet
        food={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
