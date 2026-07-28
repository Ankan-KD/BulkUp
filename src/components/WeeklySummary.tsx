"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { computeWeeklySummary } from "@/lib/weeklySummary";
import { calorieGoalHitLabel } from "@/lib/goalCopy";
import { Card } from "@/components/ui/card";
import { Flame, Beef, Scale, Flame as StreakIcon, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";

export function WeeklySummary() {
  const { foods, history, today, weights, settings } = useStore();

  const summary = useMemo(
    () => computeWeeklySummary(foods, history, today, weights, settings),
    [foods, history, today, weights, settings]
  );

  const TrendIcon =
    summary.weightChangeKg === null
      ? Minus
      : summary.weightChangeKg === 0
      ? Minus
      : (summary.weightChangeKg > 0) === (settings.goalMode !== "lose")
      ? TrendingUp
      : TrendingDown;

  return (
    <div className="space-y-3">
      {/* Headline insight */}
      <Card tint="progress" className="p-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/12 dark:bg-blue-400/15 text-blue-600 dark:text-blue-300">
          <Sparkles className="w-[18px] h-[18px]" />
        </span>
        <div>
          <p className="text-sm font-medium leading-snug">{summary.headline}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {summary.daysTracked} of 7 days logged this week
          </p>
        </div>
      </Card>

      {/* Averages */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card tint="calories" className="p-3.5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/12 dark:bg-orange-400/15 text-orange-600 dark:text-orange-400">
            <Flame className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-muted)] truncate">Avg calories</p>
            <p className="text-sm font-semibold tabular-nums">
              {summary.avgCalories} <span className="font-normal text-[var(--text-muted)]">/ day</span>
            </p>
          </div>
        </Card>
        <Card tint="protein" className="p-3.5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/12 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400">
            <Beef className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-muted)] truncate">Avg protein</p>
            <p className="text-sm font-semibold tabular-nums">
              {summary.avgProtein}g <span className="font-normal text-[var(--text-muted)]">/ day</span>
            </p>
          </div>
        </Card>
      </div>

      {/* Goal days + streak */}
      <Card tint="progress" className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-display font-semibold tabular-nums">{summary.daysGoalAchieved}/7</p>
            <p className="text-xs text-[var(--text-muted)]">{calorieGoalHitLabel(settings.goalMode)}</p>
          </div>
          {summary.weeklyStreak > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-400/15 text-amber-600 dark:text-amber-300 px-3 py-1.5">
              <StreakIcon className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">{summary.weeklyStreak}-day streak</span>
            </div>
          )}
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-blue-500/10 dark:bg-blue-400/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all duration-500"
            style={{ width: `${(summary.daysGoalAchieved / 7) * 100}%` }}
          />
        </div>
      </Card>

      {/* Consistency score */}
      <Card tint="progress" className="p-4 flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <svg viewBox="0 0 44 44" className="-rotate-90 h-12 w-12">
            <circle cx="22" cy="22" r="18" strokeWidth="4" className="fill-none stroke-blue-500/10 dark:stroke-blue-400/10" />
            <circle
              cx="22"
              cy="22"
              r="18"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
              className="stroke-blue-500 dark:stroke-blue-400"
              strokeDasharray={2 * Math.PI * 18}
              strokeDashoffset={2 * Math.PI * 18 * (1 - summary.consistencyScore / 100)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
            {summary.consistencyScore}%
          </span>
        </div>
        <div>
          <p className="text-sm font-medium">Consistency score</p>
          <p className="text-xs text-[var(--text-muted)]">Average checklist completion this week</p>
        </div>
      </Card>

      {/* Weight trend */}
      {summary.weightTrendLabel && (
        <Card tint="water" className="p-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/10 dark:bg-cyan-400/12 text-cyan-600 dark:text-cyan-300">
            <Scale className="w-[18px] h-[18px]" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Weight trend</p>
            <p className="text-xs text-[var(--text-muted)]">{summary.weightTrendLabel}</p>
          </div>
          <TrendIcon className="w-4 h-4 text-[var(--text-muted)]" />
        </Card>
      )}
    </div>
  );
}
