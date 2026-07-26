"use client";

import { Calendar, CalendarCheck, Flame, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Sheet } from "./ui/sheet";
import { MilestoneKey } from "@/lib/types";
import { MilestoneStatus } from "@/lib/milestones";

const MILESTONE_ICONS: Record<MilestoneKey, typeof Trophy> = {
  first_week: Calendar,
  first_month: CalendarCheck,
  first_5kg_gained: TrendingUp,
  first_5kg_lost: TrendingDown,
  goal_reached: Trophy,
  streak_30_day: Flame,
};

export function MilestoneCelebration({
  milestone,
  onClose,
}: {
  milestone: MilestoneStatus | null;
  onClose: () => void;
}) {
  if (!milestone) return null;
  const Icon = MILESTONE_ICONS[milestone.key];

  return (
    <Sheet open={!!milestone} onClose={onClose}>
      <div className="flex flex-col items-center text-center py-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-nova-500 to-aurora-500 shadow-glow-nova mb-4 animate-pulse-glow">
          <Icon className="w-7 h-7 text-white" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-aurora-500 mb-1">
          Milestone unlocked
        </p>
        <h2 className="font-display text-xl font-semibold mb-1.5">{milestone.title}</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">{milestone.description}</p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl2 bg-gradient-to-br from-nova-500 to-aurora-500 text-white font-medium shadow-glow-nova active:scale-[0.98] transition-transform"
        >
          Nice!
        </button>
      </div>
    </Sheet>
  );
}
