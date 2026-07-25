"use client";
import { FoodEditorSheet } from "@/components/FoodEditorSheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { FoodTemplate } from "@/lib/types";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { useMemo, useState } from "react";

export default function FoodsPage() {
  const { foods, archiveFood, updateFood } = useStore();
  const [editing, setEditing] = useState<FoodTemplate | null | "new">(null);
  const active = useMemo(
    () => foods.filter((f) => !f.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [foods]
  );
  const archived = useMemo(() => foods.filter((f) => f.archived), [foods]);

  function unarchiveFood(id: string) {
    updateFood(id, { archived: false });
  }

  return (
    <div className="px-5 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-muted)]">Your regulars</p>
          <h1 className="font-display text-2xl font-semibold">Foods</h1>
        </div>
        <Button size="icon" onClick={() => setEditing("new")} aria-label="Add food">
          <Plus className="w-5 h-5" />
        </Button>
      </header>
      <div className="space-y-2.5">
        {active.map((food) => (
          <Card key={food.id} className="p-4 flex items-center gap-3">
            <span className="text-2xl">{food.emoji}</span>
            <button className="flex-1 text-left" onClick={() => setEditing(food)}>
              <p className="font-medium text-[15px]">{food.name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Target: {food.targetQuantity} {food.unit === "serving" ? "serving" : food.unit} · {Math.round(
                  food.kind === "binary" ? food.calories : food.calories * food.targetQuantity
                )} kcal
              </p>
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
        {active.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-3xl mb-2">🌱</p>
            <p className="text-sm text-[var(--text-muted)]">
              Add the foods you eat regularly to build your daily checklist.
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