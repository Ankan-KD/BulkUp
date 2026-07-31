"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { FoodEditorSheet } from "@/components/FoodEditorSheet";
import { MoveToDietSheet } from "@/components/MoveToDietSheet";
import { DietFoodPickerSheet } from "@/components/DietFoodPickerSheet";
import { ComboEditorSheet } from "@/components/ComboEditorSheet";
import { FoodTemplate, FoodCategory, RecentFoodTemplate, MealCombo } from "@/lib/types";
import { CATEGORY_ICON_KEYS, FoodIcon, getCategoryStyle } from "@/lib/icons";
import { formatDateLabel, addDaysISO, round1 } from "@/lib/utils";
import {
  Plus,
  Archive,
  ArchiveRestore,
  Trash2,
  Dumbbell,
  UtensilsCrossed,
  ListPlus,
  History as HistoryIcon,
  Zap,
  Copy,
  Pencil,
  ChevronDown,
} from "lucide-react";

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

function describeDays(food: Pick<FoodTemplate, "activeDays" | "dateOnly">): string {
  if (food.dateOnly) return `Just ${formatDateLabel(food.dateOnly)}`;
  const days = food.activeDays;
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
  category: FoodCategory;
  items: FoodTemplate[];
}

export default function FoodsPage() {
  const {
    foods,
    archiveFood,
    deleteFood,
    updateFood,
    recentFoods,
    today,
    history,
    deleteRecentFood,
    combos,
    logCombo,
    deleteCombo,
    duplicateCombo,
  } = useStore();
  const [tab, setTab] = useState<"diet" | "combos" | "recent">("diet");
  const [editing, setEditing] = useState<FoodTemplate | null | "new">(null);
  const [dietPrefill, setDietPrefill] = useState<Partial<FoodTemplate> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<FoodTemplate | null>(null);
  const [movingToDiet, setMovingToDiet] = useState<RecentFoodTemplate | null>(null);
  const [confirmDeleteRecent, setConfirmDeleteRecent] = useState<RecentFoodTemplate | null>(null);
  const [expandedRecentId, setExpandedRecentId] = useState<string | null>(null);

  const [editingCombo, setEditingCombo] = useState<MealCombo | null | "new">(null);
  const [confirmDeleteCombo, setConfirmDeleteCombo] = useState<MealCombo | null>(null);
  const [justLoggedCombo, setJustLoggedCombo] = useState<string | null>(null);
  const [skippedNote, setSkippedNote] = useState<{ comboId: string; names: string[] } | null>(null);

  const active = useMemo(
    () => foods.filter((f) => !f.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [foods]
  );
  const archived = useMemo(() => foods.filter((f) => f.archived), [foods]);
  const sortedCombos = useMemo(() => [...combos].sort((a, b) => a.sortOrder - b.sortOrder), [combos]);

  // Most-recently-eaten first, using each Recent Food's latest log date
  // across today + history (falls back to when it was first created if it
  // somehow has no logs yet, e.g. added via a combo that hasn't run).
  const { recentSorted, lastEaten } = useMemo(() => {
    const lastEaten = new Map<string, string>();
    for (const day of [...history, today]) {
      for (const log of day.recentLogs) {
        const prev = lastEaten.get(log.recentFoodId);
        if (!prev || day.date > prev) lastEaten.set(log.recentFoodId, day.date);
      }
    }
    const recentSorted = [...recentFoods].sort((a, b) => {
      const da = lastEaten.get(a.id) ?? a.createdAt;
      const db = lastEaten.get(b.id) ?? b.createdAt;
      return db.localeCompare(da);
    });
    return { recentSorted, lastEaten };
  }, [recentFoods, history, today]);

  // Recent Foods only shows the last 7 days' worth of activity — older
  // one-offs quietly age out instead of piling up forever.
  const sevenDaysAgo = useMemo(() => addDaysISO(today.date, -6), [today.date]);
  const recentWeek = useMemo(
    () => recentSorted.filter((f) => (lastEaten.get(f.id) ?? f.createdAt) >= sevenDaysAgo),
    [recentSorted, lastEaten, sevenDaysAgo]
  );

  function lastEatenLabel(id: string) {
    const date = lastEaten.get(id);
    return date ? `Last had ${formatDateLabel(date)}` : "Not logged yet";
  }

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
      category: c,
      items: standard.get(c)!,
    }));

    const customGroups: FoodGroup[] = Array.from(custom.keys())
      .sort((a, b) => customLabels.get(a)!.localeCompare(customLabels.get(b)!))
      .map((key) => ({
        key: `custom:${key}`,
        label: customLabels.get(key)!,
        icon: CATEGORY_ICON_KEYS.custom,
        category: "custom" as FoodCategory,
        items: custom.get(key)!,
      }));

    return [...standardGroups, ...customGroups];
  }, [active]);

  function unarchiveFood(id: string) {
    updateFood(id, { archived: false });
  }

  function closeFoodEditor() {
    setEditing(null);
    setDietPrefill(null);
  }

  function describeCombo(combo: MealCombo): string {
    const names = combo.items
      .map((i) =>
        i.foodId ? foods.find((f) => f.id === i.foodId)?.name : recentFoods.find((f) => f.id === i.recentFoodId)?.name
      )
      .filter((n): n is string => !!n);
    if (names.length === 0) return "No foods (edit to add some)";
    return names.join(" · ");
  }

  function handleLogCombo(combo: MealCombo) {
    const result = logCombo(combo.id);
    setJustLoggedCombo(combo.id);
    setSkippedNote(result.skippedNames.length > 0 ? { comboId: combo.id, names: result.skippedNames } : null);
    setTimeout(() => setJustLoggedCombo((cur) => (cur === combo.id ? null : cur)), 1600);
  }

  return (
    <div className="px-5 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-muted)]">Your ingredients</p>
          <h1 className="font-display text-2xl font-semibold">Foods</h1>
        </div>
        <div className="flex items-center gap-2">
          {tab === "diet" && (
            <Button size="icon" onClick={() => setPickerOpen(true)} aria-label="Add food">
              <Plus className="w-5 h-5" />
            </Button>
          )}
          {tab === "combos" && (
            <Button size="icon" onClick={() => setEditingCombo("new")} aria-label="New combo">
              <Plus className="w-5 h-5" />
            </Button>
          )}
        </div>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-1.5 rounded-xl2 bg-nova-700/6 dark:bg-nova-100/6 p-1">
        {([
          { key: "diet" as const, label: "Diet" },
          { key: "combos" as const, label: "Logged Combos" },
          { key: "recent" as const, label: "Recent Foods" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2 rounded-xl text-[13px] font-medium transition-colors ${
              tab === t.key ? "bg-[var(--bg-elevated)] shadow-soft text-[var(--text)]" : "text-[var(--text-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "diet" ? (
      <>
      <div className="space-y-6">
        {grouped.map(({ key, label, icon, category, items }) => {
          const sectionStyle = getCategoryStyle(category);
          return (
          <section key={key}>
            <div className="flex items-center gap-2 mb-2.5 px-0.5">
              <FoodIcon iconKey={icon} category={category} size="sm" />
              <h2 className="font-display text-[15px] font-semibold">{label}</h2>
              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${sectionStyle.chipBg} ${sectionStyle.chipText}`}>
                {items.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {items.map((food) => (
                <Card
                  key={food.id}
                  className={`p-4 flex items-center gap-3 border-l-[3px] ${sectionStyle.accentBorder} ${sectionStyle.cardTint}`}
                >
                  <FoodIcon iconKey={food.emoji} category={food.category} />
                  <button className="flex-1 text-left" onClick={() => setEditing(food)}>
                    <p className="font-medium text-[15px]">{food.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Target: {food.targetQuantity} {food.unit === "serving" ? "serving" : food.unit} · {Math.round(
                        food.kind === "binary" ? food.calories : food.calories * food.targetQuantity
                      )} kcal
                    </p>
                    <p className="text-[11px] text-nova-400 mt-0.5">{describeDays(food)}</p>
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
          );
        })}

        {active.length === 0 && (
          <Card className="p-8 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-nova-500/12 dark:bg-nova-400/15 mb-3">
              <Dumbbell className="w-6 h-6 text-nova-600 dark:text-nova-300" fill="currentColor" fillOpacity={0.22} strokeWidth={1.75} />
            </span>
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
                <FoodIcon iconKey={food.emoji} category={food.category} size="sm" className="opacity-80" />
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
      </>
      ) : tab === "combos" ? (
      <div className="space-y-2.5">
        {sortedCombos.map((combo) => (
          <Card key={combo.id} className="p-4">
            <div className="flex items-center gap-3">
              <FoodIcon iconKey={combo.icon} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[15px]">{combo.name}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{describeCombo(combo)}</p>
              </div>
              <button
                onClick={() => handleLogCombo(combo)}
                disabled={combo.items.length === 0}
                className={`h-9 px-3.5 flex items-center gap-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 ${
                  justLoggedCombo === combo.id
                    ? "bg-nova-600 text-white"
                    : "bg-gradient-to-br from-nova-500 to-aurora-500 text-white shadow-glow-nova"
                }`}
                aria-label={`Log ${combo.name}`}
              >
                <Zap className="w-3.5 h-3.5" />
                {justLoggedCombo === combo.id ? "Logged!" : "Log"}
              </button>
              <button
                onClick={() => duplicateCombo(combo.id)}
                className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-nova-700/8 dark:hover:bg-nova-100/8"
                aria-label={`Duplicate ${combo.name}`}
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditingCombo(combo)}
                className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-nova-700/8 dark:hover:bg-nova-100/8"
                aria-label={`Edit ${combo.name}`}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmDeleteCombo(combo)}
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

        {sortedCombos.length === 0 && (
          <Card className="p-8 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-nova-500/12 dark:bg-nova-400/15 mb-3">
              <UtensilsCrossed className="w-6 h-6 text-nova-600 dark:text-nova-300" fill="currentColor" fillOpacity={0.22} strokeWidth={1.75} />
            </span>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Save meals you eat often — like breakfast or your go-to lunch — and log the whole thing in one tap.
            </p>
            <Button onClick={() => setEditingCombo("new")}>Create your first combo</Button>
          </Card>
        )}
      </div>
      ) : (
      <div className="space-y-2.5">
        {recentWeek.map((food) => {
          const expanded = expandedRecentId === food.id;
          const factor = food.kind === "binary" ? 1 : food.targetQuantity;
          return (
          <Card key={food.id} className="p-4">
            <div className="flex items-center gap-3">
              <FoodIcon iconKey={food.emoji} category={food.category} />
              <button
                className="flex-1 text-left min-w-0"
                onClick={() => setExpandedRecentId(expanded ? null : food.id)}
                aria-expanded={expanded}
              >
                <p className="font-medium text-[15px] truncate">{food.name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {Math.round(food.calories * factor)} kcal · {lastEatenLabel(food.id)}
                </p>
              </button>
              <ChevronDown
                className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
              />
              <button
                onClick={() => setMovingToDiet(food)}
                className="h-9 w-9 flex items-center justify-center rounded-full text-nova-400 hover:bg-nova-700/8 dark:hover:bg-nova-100/8"
                aria-label={`Move ${food.name} to Diet`}
                title="Move to Diet"
              >
                <ListPlus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmDeleteRecent(food)}
                className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-ember-600/10 hover:text-ember-600"
                aria-label={`Delete ${food.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {expanded && (
              <div className="mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-semibold">{round1(food.protein * factor)}g</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Protein</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{round1(food.carbs * factor)}g</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Carbs</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{round1(food.fats * factor)}g</p>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Fat</p>
                </div>
              </div>
            )}
          </Card>
          );
        })}

        {recentWeek.length === 0 && (
          <Card className="p-8 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-nova-500/12 dark:bg-nova-400/15 mb-3">
              <HistoryIcon className="w-6 h-6 text-nova-600 dark:text-nova-300" strokeWidth={1.75} />
            </span>
            <p className="text-sm text-[var(--text-muted)]">
              Anything you log that isn&apos;t part of your Diet — a one-off pizza, biryani, whatever — shows up
              here for 7 days, with a history of when you had it. Log it from the chat or the + button on Today.
            </p>
          </Card>
        )}
      </div>
      )}

      <DietFoodPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(prefill) => {
          setDietPrefill(prefill);
          setPickerOpen(false);
          setEditing("new");
        }}
        onManual={() => {
          setDietPrefill(null);
          setPickerOpen(false);
          setEditing("new");
        }}
      />

      <FoodEditorSheet
        food={editing === "new" ? null : editing}
        initial={editing === "new" ? dietPrefill : null}
        open={editing !== null}
        onClose={closeFoodEditor}
      />

      <MoveToDietSheet food={movingToDiet} open={movingToDiet !== null} onClose={() => setMovingToDiet(null)} />

      <ComboEditorSheet
        combo={editingCombo === "new" ? null : editingCombo}
        open={editingCombo !== null}
        onClose={() => setEditingCombo(null)}
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

      <Sheet open={confirmDeleteRecent !== null} onClose={() => setConfirmDeleteRecent(null)} title="Delete from Recent Foods?">
        {confirmDeleteRecent && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              This removes <span className="font-medium text-[var(--text)]">{confirmDeleteRecent.name}</span> and its
              logged history from Recent Foods. This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteRecent(null)}>
                Cancel
              </Button>
              <button
                onClick={() => {
                  deleteRecentFood(confirmDeleteRecent.id);
                  setConfirmDeleteRecent(null);
                }}
                className="flex-1 rounded-xl bg-ember-600 text-white text-sm font-medium hover:bg-ember-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={confirmDeleteCombo !== null} onClose={() => setConfirmDeleteCombo(null)} title="Delete combo?">
        {confirmDeleteCombo && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              This deletes <span className="font-medium text-[var(--text)]">{confirmDeleteCombo.name}</span>. Foods
              in your Foods list won&apos;t be affected. This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteCombo(null)}>
                Cancel
              </Button>
              <button
                onClick={() => {
                  deleteCombo(confirmDeleteCombo.id);
                  setConfirmDeleteCombo(null);
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
