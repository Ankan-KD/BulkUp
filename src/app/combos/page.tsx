"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ComboEditorSheet } from "@/components/ComboEditorSheet";
import { MealCombo } from "@/lib/types";
import { FoodIcon } from "@/lib/icons";
import { ArrowLeft, Plus, Copy, Pencil, Trash2, Zap, UtensilsCrossed } from "lucide-react";

export default function CombosPage() {
  const { combos, foods, recentFoods, logCombo, deleteCombo, duplicateCombo } = useStore();
  const [editing, setEditing] = useState<MealCombo | null | "new">(null);
  const [confirmDelete, setConfirmDelete] = useState<MealCombo | null>(null);
  const [justLogged, setJustLogged] = useState<string | null>(null);
  const [skippedNote, setSkippedNote] = useState<{ comboId: string; names: string[] } | null>(null);

  const sorted = useMemo(() => [...combos].sort((a, b) => a.sortOrder - b.sortOrder), [combos]);

  function describeCombo(combo: MealCombo): string {
    const names = combo.items
      .map((i) =>
        i.foodId ? foods.find((f) => f.id === i.foodId)?.name : recentFoods.find((f) => f.id === i.recentFoodId)?.name
      )
      .filter((n): n is string => !!n);
    if (names.length === 0) return "No foods (edit to add some)";
    return names.join(" · ");
  }

  function handleLog(combo: MealCombo) {
    const result = logCombo(combo.id);
    setJustLogged(combo.id);
    setSkippedNote(result.skippedNames.length > 0 ? { comboId: combo.id, names: result.skippedNames } : null);
    setTimeout(() => setJustLogged((cur) => (cur === combo.id ? null : cur)), 1600);
  }

  return (
    <div className="px-5 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/foods"
            aria-label="Back to Foods"
            className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-nova-500/10 -ml-1.5"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </Link>
          <div>
            <p className="text-sm text-[var(--text-muted)]">Save your regulars</p>
            <h1 className="font-display text-2xl font-semibold">Meal Combos</h1>
          </div>
        </div>
        <Button size="icon" onClick={() => setEditing("new")} aria-label="New combo">
          <Plus className="w-5 h-5" />
        </Button>
      </header>

      <div className="space-y-2.5">
        {sorted.map((combo) => (
          <Card key={combo.id} className="p-4">
            <div className="flex items-center gap-3">
              <FoodIcon iconKey={combo.icon} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[15px]">{combo.name}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{describeCombo(combo)}</p>
              </div>
              <button
                onClick={() => handleLog(combo)}
                disabled={combo.items.length === 0}
                className={`h-9 px-3.5 flex items-center gap-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                  justLogged === combo.id
                    ? "bg-nova-600 text-white"
                    : "bg-gradient-to-br from-nova-500 to-aurora-500 text-white shadow-glow-nova"
                }`}
                aria-label={`Log ${combo.name}`}
              >
                <Zap className="w-3.5 h-3.5" />
                {justLogged === combo.id ? "Logged!" : "Log"}
              </button>
              <button
                onClick={() => duplicateCombo(combo.id)}
                className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-nova-700/8 dark:hover:bg-nova-100/8"
                aria-label={`Duplicate ${combo.name}`}
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditing(combo)}
                className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-nova-700/8 dark:hover:bg-nova-100/8"
                aria-label={`Edit ${combo.name}`}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmDelete(combo)}
                className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-ember-600/10 hover:text-ember-600"
                aria-label={`Delete ${combo.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {skippedNote?.comboId === combo.id && (
              <p className="mt-2.5 text-[11px] text-ember-600">
                {skippedNote.names.join(", ")} {skippedNote.names.length === 1 ? "isn't" : "aren't"} scheduled for
                today, so {skippedNote.names.length === 1 ? "it wasn't" : "they weren't"} logged.
              </p>
            )}
          </Card>
        ))}

        {sorted.length === 0 && (
          <Card className="p-8 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-nova-500/12 dark:bg-nova-400/15 mb-3">
              <UtensilsCrossed className="w-6 h-6 text-nova-600 dark:text-nova-300" fill="currentColor" fillOpacity={0.22} strokeWidth={1.75} />
            </span>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Save meals you eat often — like breakfast or your go-to lunch — and log the whole thing in one tap.
            </p>
            <Button onClick={() => setEditing("new")}>Create your first combo</Button>
          </Card>
        )}
      </div>

      <ComboEditorSheet
        combo={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />

      <Sheet open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title="Delete combo?">
        {confirmDelete && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              This deletes <span className="font-medium text-[var(--text)]">{confirmDelete.name}</span>. Foods in
              your Foods list won&apos;t be affected. This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <button
                onClick={() => {
                  deleteCombo(confirmDelete.id);
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
