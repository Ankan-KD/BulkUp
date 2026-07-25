"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { FoodEditorSheet } from "@/components/FoodEditorSheet";
import { FoodTemplate, FoodCategory } from "@/lib/types";
import { CATEGORY_ICON_KEYS, AppIcon } from "@/lib/icons";
import { Plus, Archive, ArchiveRestore, Trash2 } from "lucide-react";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "custom" is handled separately below — each distinct custom label becomes
// its own section, rather than lumping every custom food together.
const CATEGORY_ORDER: Exclude<FoodCategory, "custom">[] = [
  "protein",
  "grain",
  "vegetable",
  "fruit",
  "dairy",
  "fat",
  "other",
];

const CATEGORY_LABELS: Record<Exclude<FoodCategory, "custom">, string> = {
  protein: "Proteins",
  grain: "Carbohydrates",
  vegetable: "Vegetables",
  fruit: "Fruits",
  dairy: "Dairy",
  fat: "Fats & Nuts",
  other: "Other",
};

function describeDays(days: number[]): string {
  if (!days || days.length === 7) return "Every day";
  if (days.length === 0) return "Never shown";
  const sorted = [...days].sort();
  if (sorted.join(",") === "1,2,3,4,5") return "Weekdays";
  if (sorted.join(",") === "0,6") return "Weekends";
  return sorted.map((d) => DAY_ABBR[d]).join(", ");
}

interface FoodGroup {
  key: string;
  label: string;
  icon: string;
  items: FoodTemplate[];
}

export default function FoodsPage() {
  const { foods, archiveFood, deleteFood, updateFood } = useStore();
  const [editing, setEditing] = useState<FoodTemplate | null | "new">(null);
  const [confirmDelete, setConfirmDelete] = useState<FoodTemplate | null>(null);

  const active = useMemo(
    () => foods.filter((f) => !f.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [foods]
  );
  const archived = useMemo(() => foods.filter((f) => f.archived), [foods]);

  const grouped = useMemo((): FoodGroup[] => {
    const standard = new Map<string, FoodTemplate[]>();
    const custom = new Map<string, FoodTemplate[]>(); // keyed by lowercased label, preserving first-seen casing separately
    const customLabels = new Map<string, string>();

    for (const f of active) {
      if (f.category === "custom") {
        const label = (f.customCategory || "Custom").trim() || "Custom";
        const key = label.toLowerCase();
        if (!custom.has(key)) {
          custom.set(key, []);
          customLabels.set(key, label);
        }
        custom.get(key)!.push(f);
      } else {
        const cat = f.category || "other";
        if (!standard.has(cat)) standard.set(cat, []);
        standard.get(cat)!.push(f);
      }
    }

    const standardGroups: FoodGroup[] = CATEGORY_ORDER.filter((c) => standard.has(c)).map((c) => ({
      key: c,
      label: CATEGORY_LABELS[c],
      icon: CATEGORY_ICON_KEYS[c],
      items: standard.get(c)!,
    }));

    const customGroups: FoodGroup[] = Array.from(custom.keys())
      .sort((a, b) => customLabels.get(a)!.localeCompare(customLabels.get(b)!))
      .map((key) => ({
        key: `custom:${key}`,
        label: customLabels.get(key)!,
        icon: CATEGORY_ICON_KEYS.custom,
        items: custom.get(key)!,
      }));

    return [...standardGroups, ...customGroups];
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
        {grouped.map(({ key, label, icon, items }) => (
          <section key={key}>
            <div className="flex items-center gap-2 mb-2.5 px-0.5">
              <AppIcon name={icon} className="w-[18px] h-[18px] text-nova-400" />
              <h2 className="font-display text-[15px] font-semibold">{label}</h2>
              <span className="text-xs text-[var(--text-muted)]">({items.length})</span>
            </div>
            <div className="space-y-2.5">
              {items.map((food) => (
                <Card key={food.id} className="p-4 flex items-center gap-3">
                  <span className="h-9 w-9 flex items-center justify-center rounded-xl bg-nova-700/8 shrink-0">
                    <AppIcon name={food.emoji} className="w-[18px] h-[18px]" />
                  </span>
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
                  <button
                    onClick={() => setConfirmDelete(food)}
                    className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-ember-600/10 hover:text-ember-600"
                    aria-label={`Delete ${food.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
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
                <span className="text-nova-400"><AppIcon name={food.emoji} className="w-4 h-4" /></span>
                <p className="flex-1 text-sm">{food.name}</p>
                <button
                  onClick={() => unarchiveFood(food.id)}
                  className="h-8 w-8 flex items-center justify-center rounded-full text-nova-400 hover:bg-nova-700/12"
                  aria-label={`Restore ${food.name}`}
                >
                  <ArchiveRestore className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete(food)}
                  className="h-8 w-8 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-ember-600/10 hover:text-ember-600"
                  aria-label={`Delete ${food.name}`}
                >
                  <Trash2 className="w-4 h-4" />
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

      <Sheet open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title="Delete food?">
        {confirmDelete && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              This permanently deletes <span className="font-medium text-[var(--text)]">{confirmDelete.name}</span>{" "}
              and removes it from any past days it was logged on. This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <button
                onClick={() => {
                  deleteFood(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="flex-1 rounded-xl bg-ember-600 text-white text-sm font-medium hover:bg-ember-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
