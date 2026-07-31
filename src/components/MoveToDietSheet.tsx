"use client";

import { useState } from "react";
import { Sheet } from "./ui/sheet";
import { Button } from "./ui/button";
import { useStore } from "@/lib/store";
import { RecentFoodTemplate } from "@/lib/types";
import { FoodIcon } from "@/lib/icons";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * The only path by which a Recent Food becomes part of the Diet — always
 * an explicit, user-driven action. The AI is never allowed to do this.
 */
export function MoveToDietSheet({
  food,
  open,
  onClose,
}: {
  food: RecentFoodTemplate | null;
  open: boolean;
  onClose: () => void;
}) {
  const { moveRecentFoodToDiet } = useStore();
  const [activeDays, setActiveDays] = useState<number[]>(ALL_DAYS);

  if (!food) return null;

  function confirm() {
    if (!food || activeDays.length === 0) return;
    moveRecentFoodToDiet(food.id, { activeDays, dateOnly: null });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Move to Diet">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5">
          <FoodIcon iconKey={food.emoji} category={food.category} size="md" />
          <div>
            <p className="text-sm font-semibold">{food.name}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {food.calories} kcal · {food.protein}g protein
            </p>
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          Pick which days {food.name} should appear in Today&apos;s Checklist from now on. This won&apos;t remove it
          from your Recent Foods history.
        </p>

        <div className="flex items-center justify-between">
          <span className="block text-xs font-medium text-[var(--text-muted)]">Days it appears</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setActiveDays(ALL_DAYS)} className="text-[11px] font-medium text-nova-400">
              Every day
            </button>
            <button
              type="button"
              onClick={() => setActiveDays([1, 2, 3, 4, 5])}
              className="text-[11px] font-medium text-nova-400"
            >
              Weekdays
            </button>
            <button type="button" onClick={() => setActiveDays([0, 6])} className="text-[11px] font-medium text-nova-400">
              Weekends
            </button>
          </div>
        </div>

        <div className="flex gap-1.5">
          {DAY_LABELS.map((label, i) => {
            const selected = activeDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                title={DAY_FULL[i]}
                onClick={() =>
                  setActiveDays((d) => (selected ? d.filter((x) => x !== i) : [...d, i].sort()))
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
        {activeDays.length === 0 && (
          <p className="text-[11px] text-ember-400 -mt-2">Pick at least one day, or it will never show up.</p>
        )}

        <Button className="w-full" size="lg" onClick={confirm} disabled={activeDays.length === 0}>
          Add to Diet
        </Button>
      </div>
    </Sheet>
  );
}
