"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { computeStreaks, StreakInfo } from "@/lib/streaks";
import { computeMilestoneStatuses } from "@/lib/milestones";
import { Card } from "@/components/ui/card";
import {
  Beef,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Flame,
  Lock,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { MilestoneKey } from "@/lib/types";

const MILESTONE_ICONS: Record<MilestoneKey, typeof Trophy> = {
  first_week: Calendar,
  first_month: CalendarCheck,
  first_5kg_gained: TrendingUp,
  first_5kg_lost: TrendingDown,
  goal_reached: Trophy,
  streak_30_day: Flame,
};

export function StreaksAchievements() {
  const { foods, history, today, weights, settings } = useStore();

  const streaks = useMemo(
    () => computeStreaks(foods, history, today, settings),
    [foods, history, today, settings]
  );
  const milestones = useMemo(
    () => computeMilestoneStatuses(foods, history, today, weights, settings),
    [foods, history, today, weights, settings]
  );

  const unlockedCount = milestones.filter((m) => m.achieved).length;

  return (
    <div className="space-y-5">
      <section>
        <h2 className="font-display text-lg font-semibold mb-3">Streaks</h2>
        <div className="grid grid-cols-3 gap-2.5">
          <StreakChip icon={Flame} label="Calorie goal" streak={streaks.calorie} />
          <StreakChip icon={Beef} label="Protein goal" streak={streaks.protein} />
          <StreakChip icon={CheckCircle2} label="Checklist" streak={streaks.checklist} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Achievements</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {unlockedCount}/{milestones.length} unlocked
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {milestones.map((m) => {
            const Icon = MILESTONE_ICONS[m.key];
            return (
              <Card
                key={m.key}
                className={`p-3.5 flex flex-col items-center text-center gap-1.5 ${
                  m.achieved ? "" : "opacity-55"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    m.achieved
                      ? "bg-gradient-to-br from-nova-500 to-aurora-500 text-white"
                      : "bg-nova-700/8 dark:bg-nova-100/8 text-[var(--text-muted)]"
                  }`}
                >
                  {m.achieved ? <Icon className="w-[18px] h-[18px]" /> : <Lock className="w-[18px] h-[18px]" />}
                </span>
                <p className="text-xs font-semibold leading-tight">{m.title}</p>
                <p className="text-[11px] text-[var(--text-muted)] leading-tight">{m.description}</p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StreakChip({
  icon: Icon,
  label,
  streak,
}: {
  icon: typeof Flame;
  label: string;
  streak: StreakInfo;
}) {
  return (
    <Card className="p-3 flex flex-col items-center text-center gap-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ember-500/10 text-ember-500">
        <Icon className="w-4 h-4" />
      </span>
      <p className="text-lg font-display font-semibold tabular-nums leading-tight">{streak.current}</p>
      <p className="text-[10px] text-[var(--text-muted)] leading-tight">{label}</p>
      <p className="text-[10px] text-[var(--text-muted)] leading-tight">best {streak.best}</p>
    </Card>
  );
}
