"use client";

import { AppIcon } from "@/components/AppIcon";
import { FoodChecklistItem } from "@/components/FoodChecklistItem";
import { GrowthRing } from "@/components/GrowthRing";
import { ManualLogSheet } from "@/components/ManualLogSheet";
import { MilestoneCelebration } from "@/components/MilestoneCelebration";
import { Card } from "@/components/ui/card";
import { calorieRemainingLabel, dashboardHeading, progressStatus, progressStatusLabel } from "@/lib/goalCopy";
import { CATEGORY_ICON_KEYS, FoodIcon, getCategoryStyle } from "@/lib/icons";
import { MilestoneStatus, computeMilestoneStatuses } from "@/lib/milestones";
import { computeCombinedTotals, foodProgress } from "@/lib/nutrition";
import { useStore } from "@/lib/store";
import { FoodCategory, FoodTemplate } from "@/lib/types";
import { cn, isFoodScheduledOn, relativeDayLabel } from "@/lib/utils";
import { Beef, Droplets, Flame, PieChart, Plus, Settings, Wheat } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// Same grouping order/labels as the Foods tab (src/app/foods/page.tsx), so
// "Today's foods" reads consistently with how foods are organized there.
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

interface FoodGroup {
  key: string;
  label: string;
  icon: string;
  category: FoodCategory;
  items: FoodTemplate[];
}

// ── Today's Consumption (Dashboard, second tab) ──────────────────────────
// A flat, real-world log of everything eaten today — independent of the
// planned Diet. Combines:
//   • Recent Foods logged today (dishes/snacks that aren't Diet items),
//     badged "Mapped" if their ingredients credited a Diet item, else "Extra".
//   • Diet items whose progress was moved by a *direct* tap/entry today
//     (not just credited via another dish's ingredients), badged "Diet".
// See DailyFoodLog.contributedQuantity / RecentFoodLogEntry.mapped in
// src/lib/types.ts for how the two sources are told apart.
type ConsumptionBadgeKind = "Diet" | "Mapped" | "Extra";

interface ConsumptionEntry {
  key: string;
  name: string;
  icon: string;
  category: FoodCategory;
  quantity: number;
  unit: string;
  badge: ConsumptionBadgeKind;
}

function formatConsumptionQty(quantity: number, unit: string): string {
  const rounded = Math.round(quantity * 100) / 100;
  if (unit === "serving" || unit === "count") return `${rounded}`;
  return `${rounded}${unit}`;
}

export default function DashboardPage() {
  const {
    settings,
    foods,
    recentFoods,
    today,
    viewDay,
    history,
    weights,
    milestones,
    addWaterMl,
    recordMilestone,
    ready,
  } = useStore();
  const router = useRouter();
  const [celebrating, setCelebrating] = useState<MilestoneStatus | null>(null);
  const [manualLogOpen, setManualLogOpen] = useState(false);
  const [tab, setTab] = useState<"diet" | "consumption">("diet");
  const isViewToday = viewDay.date === today.date;
  const viewLabel = relativeDayLabel(viewDay.date);

  useEffect(() => {
    if (ready && !settings.onboarded) router.replace("/onboarding");
  }, [ready, settings.onboarded, router]);

  const milestoneStatuses = useMemo(
    () => computeMilestoneStatuses(foods, history, today, weights, settings),
    [foods, history, today, weights, settings]
  );

  // Celebrate one newly-unlocked milestone at a time. We only look for the
  // next one once the current celebration has been dismissed, so a rapid
  // string of unlocks doesn't flash past the user unseen.
  useEffect(() => {
    if (!ready || celebrating) return;
    const newlyAchieved = milestoneStatuses.find(
      (m) => m.achieved && !milestones.some((rec) => rec.key === m.key)
    );
    if (newlyAchieved) {
      recordMilestone(newlyAchieved.key);
      setCelebrating(newlyAchieved);
    }
  }, [ready, celebrating, milestoneStatuses, milestones, recordMilestone]);

  const totals = useMemo(() => computeCombinedTotals(foods, recentFoods, viewDay), [foods, recentFoods, viewDay]);
  const activeFoods = useMemo(() => {
    return foods
      .filter((f) => !f.archived && isFoodScheduledOn(f, viewDay.date))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [foods, viewDay]);

  const groupedActiveFoods = useMemo((): FoodGroup[] => {
    const standard = new Map<string, FoodTemplate[]>();
    const custom = new Map<string, FoodTemplate[]>(); // keyed by lowercased label, preserving first-seen casing separately
    const customLabels = new Map<string, string>();

    for (const f of activeFoods) {
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
  }, [activeFoods]);

  // Today's Consumption — see the type/comment above. Recent Foods first
  // (the common case — most days are mostly "real world" dishes), then any
  // Diet items that were logged directly today.
  const consumptionEntries = useMemo((): ConsumptionEntry[] => {
    const entries: ConsumptionEntry[] = [];

    for (const log of viewDay.recentLogs) {
      if (log.loggedQuantity <= 0) continue;
      const item = recentFoods.find((r) => r.id === log.recentFoodId);
      if (!item) continue;
      entries.push({
        key: `recent:${log.recentFoodId}`,
        name: item.name,
        icon: item.emoji,
        category: item.category,
        quantity: log.loggedQuantity,
        unit: item.unit,
        badge: log.mapped ? "Mapped" : "Extra",
      });
    }

    for (const f of foods) {
      const log = viewDay.logs.find((l) => l.foodId === f.id);
      if (!log) continue;
      const directQty = log.loggedQuantity - (log.contributedQuantity ?? 0);
      if (directQty <= 0) continue;
      entries.push({
        key: `diet:${f.id}`,
        name: f.name,
        icon: f.emoji,
        category: f.category,
        quantity: directQty,
        unit: f.unit,
        badge: "Diet",
      });
    }

    return entries;
  }, [viewDay, recentFoods, foods]);

  const calorieProgress = settings.calorieGoal > 0 ? totals.calories / settings.calorieGoal : 0;
  const remaining = Math.max(0, settings.calorieGoal - totals.calories);
  const waterProgress = settings.waterGoalMl > 0 ? Math.min(1, viewDay.waterMl / settings.waterGoalMl) : 0;
  const status = progressStatus(settings.goalMode, totals.calories, settings.calorieGoal);
  const statusLabel = progressStatusLabel(status);

  if (!ready || !settings.onboarded) return null;

  const greeting = settings.name ? `Hi, ${settings.name.split(" ")[0]}` : "Welcome back";

  return (
    <div className="px-5 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-muted)]">{greeting}</p>
          <h1 className="font-display text-2xl font-semibold">{dashboardHeading(settings.goalMode)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <AppIcon className="h-8 w-8 rounded-xl" />
          <Link
            href="/settings"
            aria-label="Settings"
            className="h-9 w-9 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-nova-500/10"
          >
            <Settings className="w-[18px] h-[18px]" />
          </Link>
        </div>
      </header>

      {/* Dashboard tabs — Today's Diet (the plan) vs Today's Consumption (what was actually eaten) */}
      <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-xl2 bg-nova-700/6 dark:bg-nova-100/6 p-1">
        {(
          [
            { key: "diet", label: isViewToday ? "Today's Diet" : `${viewLabel}'s Diet` },
            { key: "consumption", label: isViewToday ? "Today's Consumption" : `${viewLabel}'s Consumption` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.key ? "bg-[var(--bg-elevated)] shadow-soft text-[var(--text)]" : "text-[var(--text-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "diet" ? (
        <>
          {/* Daily Progress Hero */}
          <Card tint="progress" className="flex flex-col items-center py-8 px-4 mb-6 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-blue-400/[0.06] dark:bg-blue-400/[0.08] blur-3xl" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-nova-400/[0.06] dark:bg-nova-400/[0.08] blur-3xl" />
            <GrowthRing progress={calorieProgress} status={status}>
              <p className="font-display text-2xl font-semibold tabular-nums">
                {totals.calories}
                <span className="text-base font-body font-normal text-[var(--text-muted)]"> / {settings.calorieGoal}</span>
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">kcal logged</p>
            </GrowthRing>
            {statusLabel && (
              <span
                className={`mt-3 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  status === "success"
                    ? "bg-blue-500/12 text-blue-600 dark:text-blue-300"
                    : "bg-ember-500/12 text-ember-600 dark:text-ember-300"
                }`}
              >
                {statusLabel}
              </span>
            )}
            <div className="mt-5 flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="font-semibold font-display text-lg">{Math.round(calorieProgress * 100)}%</p>
                <p className="text-[var(--text-muted)] text-xs">completed</p>
              </div>
              <div className="w-px h-8 bg-[var(--border)]" />
              <div className="text-center">
                <p className="font-semibold font-display text-lg">{remaining}</p>
                <p className="text-[var(--text-muted)] text-xs">{calorieRemainingLabel(settings.goalMode)}</p>
              </div>
            </div>
          </Card>

          {/* Nutrition Summary — compact, secondary */}
          <section className="mb-4">
            <h2 className="font-display text-lg font-semibold mb-3">Nutrition</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <StatChip icon={Flame} label="Calories" value={`${totals.calories}`} unit="kcal" tint="calories" color="text-orange-500 dark:text-orange-400" />
              <StatChip icon={Beef} label="Protein" value={`${totals.protein}`} unit={`/ ${settings.proteinGoal}g`} tint="protein" color="text-amber-600 dark:text-amber-400" />
              <StatChip icon={Wheat} label="Carbs" value={`${totals.carbs}`} unit="g" tint="carbs" color="text-emerald-600 dark:text-emerald-400" />
              <StatChip icon={PieChart} label="Fats" value={`${totals.fats}`} unit="g" tint="fat" color="text-purple-600 dark:text-purple-400" />
            </div>

            <Card tint="water" className="w-full mt-2.5 px-4 py-3.5">
              <button
                onClick={() => addWaterMl(250)}
                className="w-full flex items-center justify-between active:scale-[0.98] transition-transform"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/12 dark:bg-cyan-400/15 text-cyan-600 dark:text-cyan-300">
                    <Droplets className="w-4 h-4" />
                  </span>
                  Water
                </span>
                <span className="text-sm text-[var(--text-muted)]">
                  {(viewDay.waterMl / 1000).toFixed(1)}L / {(settings.waterGoalMl / 1000).toFixed(1)}L
                  <span className="ml-2 text-cyan-600 dark:text-cyan-300 font-semibold">+250ml</span>
                </span>
              </button>
              <div className="mt-2.5 h-2 w-full rounded-full bg-cyan-500/10 dark:bg-cyan-400/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-500 dark:bg-cyan-400 transition-all duration-500"
                  style={{ width: `${waterProgress * 100}%` }}
                />
              </div>
            </Card>
          </section>

          {/* Today's Foods checklist */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-semibold">
                {isViewToday ? "Today's foods" : `${viewLabel}'s foods`}
              </h2>
              <span className="text-xs text-[var(--text-muted)]">
                {activeFoods.filter((f) => foodProgress(f, viewDay.logs.find((l) => l.foodId === f.id)?.loggedQuantity ?? 0) >= 1).length}/
                {activeFoods.length} done
              </span>
            </div>
            <div className="space-y-5">
              {groupedActiveFoods.map(({ key, label, icon, category, items }) => {
                const sectionStyle = getCategoryStyle(category);
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-2 px-0.5">
                      <FoodIcon iconKey={icon} category={category} size="sm" />
                      <h3 className="font-display text-[13px] font-semibold text-[var(--text-muted)]">{label}</h3>
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${sectionStyle.chipBg} ${sectionStyle.chipText}`}>
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {items.map((food) => (
                        <FoodChecklistItem
                          key={food.id}
                          food={food}
                          loggedQuantity={viewDay.logs.find((l) => l.foodId === food.id)?.loggedQuantity ?? 0}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {activeFoods.length === 0 && (
                <Card className="p-6 text-center text-sm text-[var(--text-muted)]">
                  {foods.filter((f) => !f.archived).length === 0
                    ? "No foods yet. Add your regulars in the Foods tab to build your checklist."
                    : `Nothing scheduled for ${isViewToday ? "today" : viewLabel.toLowerCase()}. Adjust a food's days in the Foods tab if that's not right.`}
                </Card>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">
              {isViewToday ? "What you've eaten" : `What you ate — ${viewLabel}`}
            </h2>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[var(--text-muted)]">{consumptionEntries.length} logged</span>
              <button
                type="button"
                onClick={() => setManualLogOpen(true)}
                className="flex items-center gap-1 text-xs font-medium text-nova-500 hover:text-nova-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Log manually
              </button>
            </div>
          </div>
          <div className="space-y-2.5">
            {consumptionEntries.map((entry) => {
              const style = getCategoryStyle(entry.category);
              return (
                <div
                  key={entry.key}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl2 border border-l-[3px] px-4 py-2.5 shadow-soft",
                    style.accentBorder,
                    "glass-panel border-[var(--border)]",
                    style.cardTint
                  )}
                >
                  <FoodIcon iconKey={entry.icon} category={entry.category} size="xl" variant="plain" />
                  <span className="flex-1 font-medium text-[15px] truncate">{entry.name}</span>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">
                    {formatConsumptionQty(entry.quantity, entry.unit)}
                  </span>
                  <ConsumptionBadge kind={entry.badge} />
                </div>
              );
            })}
            {consumptionEntries.length === 0 && (
              <Card className="p-6 text-center text-sm text-[var(--text-muted)]">
                {isViewToday
                  ? "Nothing logged yet today. Describe what you ate with the + button below, or tap \"Log manually\" above to search and log it yourself."
                  : `Nothing logged yet for ${viewLabel.toLowerCase()}. Describe what you ate with the + button below, or tap "Log manually" above to search and log it yourself.`}
              </Card>
            )}
          </div>
        </section>
      )}

      <MilestoneCelebration milestone={celebrating} onClose={() => setCelebrating(null)} />
      <ManualLogSheet open={manualLogOpen} onClose={() => setManualLogOpen(false)} />
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  unit,
  color,
  tint,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  unit: string;
  color: string;
  tint: import("@/components/ui/card").CardTint;
}) {
  return (
    <Card tint={tint} className="p-3.5 flex items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-current/10 ${color}`}>
        <Icon className={`w-[18px] h-[18px] ${color}`} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--text-muted)] truncate">{label}</p>
        <p className="text-sm font-semibold tabular-nums">
          {value} <span className="font-normal text-[var(--text-muted)]">{unit}</span>
        </p>
      </div>
    </Card>
  );
}

function ConsumptionBadge({ kind }: { kind: "Diet" | "Mapped" | "Extra" }) {
  const styles: Record<"Diet" | "Mapped" | "Extra", string> = {
    Diet: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
    Mapped: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    Extra: "bg-nova-700/8 dark:bg-nova-100/10 text-[var(--text-muted)]",
  };
  return (
    <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${styles[kind]}`}>{kind}</span>
  );
}
