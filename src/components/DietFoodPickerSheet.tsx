"use client";

import { useMemo, useState } from "react";
import { Sheet } from "./ui/sheet";
import { FoodIcon } from "@/lib/icons";
import { searchMasterFoods, mapMasterCategory, masterFoodToDietPrefill, MasterFoodEntry } from "@/lib/masterFoods";
import { FoodTemplate } from "@/lib/types";
import { Search, Sparkles } from "lucide-react";

/**
 * Step 1 of "Add to Diet": search the master food database and hand a
 * prefilled draft off to FoodEditorSheet — or bail out to a blank manual
 * entry if the food isn't in the dataset. This sheet never writes
 * anything; picking a result just closes it and calls onPick.
 */
export function DietFoodPickerSheet({
  open,
  onClose,
  onPick,
  onManual,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (prefill: Partial<FoodTemplate>) => void;
  onManual: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchMasterFoods(query, 25), [query]);

  function handleClose() {
    setQuery("");
    onClose();
  }

  function pick(entry: MasterFoodEntry) {
    onPick(masterFoodToDietPrefill(entry));
    setQuery("");
  }

  function manual() {
    setQuery("");
    onManual();
  }

  return (
    <Sheet open={open} onClose={handleClose} title="Add to Diet">
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

        <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
          {results.map((entry) => {
            const { category } = mapMasterCategory(entry);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => pick(entry)}
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

          {query.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">
              No matches for &quot;{query}&quot; in the database.
            </p>
          )}
          {query.trim().length < 2 && (
            <p className="text-xs text-[var(--text-muted)] text-center py-6">
              Start typing to search thousands of foods with ready-made nutrition info.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={manual}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-[var(--border)] text-sm font-medium text-nova-500 hover:bg-nova-500/8 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" /> Can&apos;t find your food? Create it manually
        </button>
      </div>
    </Sheet>
  );
}
