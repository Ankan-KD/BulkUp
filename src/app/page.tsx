"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { computeTotals, foodProgress } from "@/lib/nutrition";
import { computeMilestoneStatuses, MilestoneStatus } from "@/lib/milestones";
import { GrowthRing } from "@/components/GrowthRing";
import { Card } from "@/components/ui/card";
import { FoodChecklistItem } from "@/components/FoodChecklistItem";
import { MilestoneCelebration } from "@/components/MilestoneCelebration";
import { AppIcon } from "@/components/AppIcon";
import { dashboardHeading, calorieRemainingLabel, progressStatus, progressStatusLabel } from "@/lib/goalCopy";
import { dayOfWeekFromISO } from "@/lib/utils";
import { Flame, Droplets, Beef, Wheat, PieChart, Settings } from "lucide-react";

export default function DashboardPage() {
  const { settings, foods, today, history, weights, milestones, addWaterMl, recordMilestone, ready } = useStore();
  const router = useRouter();
  const [celebrating, setCelebrating] = useState<MilestoneStatus | null>(null);

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

  const totals = useMemo(() => computeTotals(foods, today), [foods, today]);
  const activeFoods = useMemo(() => {
    const todayDow = dayOfWeekFromISO(today.date); // 0 = Sunday ... 6 = Saturday
    return foods
      .filter((f) => !f.archived && f.activeDays.includes(todayDow))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [foods, today]);

  const calorieProgress = settings.calorieGoal > 0 ? totals.calories / settings.calorieGoal : 0;
  const remaining = Math.max(0, settings.calorieGoal - totals.calories);
  const waterProgress = settings.waterGoalMl > 0 ? Math.min(1, today.waterMl / settings.waterGoalMl) : 0;
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

      {/* Daily Progress Hero */}
      <Card className="flex flex-col items-center py-8 px-4 mb-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-aurora-200/30 dark:bg-aurora-900/10 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-nova-200/40 dark:bg-nova-900/20 blur-2xl" />
        <GrowthRing progress={calorieProgress} status={status}>
          <p className="font-display text-2xl font-semibold tabular-nums">
            {totals.calories}
            <span className="text-base font-body font-normal text-[var(--text-muted)]"> / {settings.calorieGoal}</span>
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">kcal today</p>
        </GrowthRing>
        {statusLabel && (
          <span
            className={`mt-3 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              status === "success"
                ? "bg-aurora-500/15 text-aurora-600"
                : "bg-ember-500/15 text-ember-600"
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

      {/* Today's Foods checklist */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Today&apos;s foods</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {activeFoods.filter((f) => foodProgress(f, today.logs.find((l) => l.foodId === f.id)?.loggedQuantity ?? 0) >= 1).length}/
            {activeFoods.length} done
          </span>
        </div>
        <div className="space-y-2.5">
          {activeFoods.map((food) => (
            <FoodChecklistItem
              key={food.id}
              food={food}
              loggedQuantity={today.logs.find((l) => l.foodId === food.id)?.loggedQuantity ?? 0}
            />
          ))}
          {activeFoods.length === 0 && (
            <Card className="p-6 text-center text-sm text-[var(--text-muted)]">
              {foods.filter((f) => !f.archived).length === 0
                ? "No foods yet. Add your regulars in the Foods tab to build your checklist."
                : "Nothing scheduled for today. Adjust a food's days in the Foods tab if that's not right."}
            </Card>
          )}
        </div>
      </section>

      {/* Nutrition Summary — compact, secondary */}
      <section className="mb-4">
        <h2 className="font-display text-lg font-semibold mb-3">Nutrition</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <StatChip icon={Flame} label="Calories" value={`${totals.calories}`} unit="kcal" color="text-ember-400" />
          <StatChip icon={Beef} label="Protein" value={`${totals.protein}`} unit={`/ ${settings.proteinGoal}g`} color="text-nova-400" />
          <StatChip icon={Wheat} label="Carbs" value={`${totals.carbs}`} unit="g" color="text-ember-300" />
          <StatChip icon={PieChart} label="Fats" value={`${totals.fats}`} unit="g" color="text-nova-300" />
        </div>
        <button
          onClick={() => addWaterMl(250)}
          className="w-full mt-2.5 flex items-center justify-between rounded-xl2 border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 shadow-soft active:scale-[0.98] transition-transform"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Droplets className="w-4 h-4 text-aurora-400" /> Water
          </span>
          <span className="text-sm text-[var(--text-muted)]">
            {(today.waterMl / 1000).toFixed(1)}L / {(settings.waterGoalMl / 1000).toFixed(1)}L
            <span className="ml-2 text-aurora-600 font-medium">+250ml</span>
          </span>
        </button>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-aurora-900/20 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-aurora-500 to-aurora-300 transition-all duration-500"
            style={{ width: `${waterProgress * 100}%` }}
          />
        </div>
      </section>

      <MilestoneCelebration milestone={celebrating} onClose={() => setCelebrating(null)} />
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <Card className="p-3.5 flex items-center gap-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full bg-current/10 ${color}`}>
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
