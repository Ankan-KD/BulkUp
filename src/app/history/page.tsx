"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { computeTotals, completionPercent, foodProgress } from "@/lib/nutrition";
import { formatDateLabel } from "@/lib/utils";
import { DayRecord } from "@/lib/types";
import { AppIcon } from "@/lib/icons";
import { Flame, Scale as ScaleIcon } from "lucide-react";

export default function HistoryPage() {
  const { foods, history, today } = useStore();
  const [selected, setSelected] = useState<DayRecord | null>(null);

  const days = useMemo(
    () => [...history, today].filter((d) => d.logs.length > 0 || d.weightKg).reverse(),
    [history, today]
  );

  return (
    <div className="px-5 pt-6">
      <header className="mb-5">
        <p className="text-sm text-[var(--text-muted)]">Consistency over time</p>
        <h1 className="font-display text-2xl font-semibold">History</h1>
      </header>

      <div className="space-y-2.5">
        {days.map((day) => {
          const pct = completionPercent(foods, day);
          const totals = computeTotals(foods, day);
          return (
            <button key={day.date} onClick={() => setSelected(day)} className="w-full text-left">
              <Card className="p-4 flex items-center gap-3">
                <RingBadge pct={pct} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[15px]">{formatDateLabel(day.date)}</p>
                  <p className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                    <Flame className="w-3 h-3" /> {totals.calories} kcal
                    {day.weightKg && (
                      <>
                        <span>·</span>
                        <ScaleIcon className="w-3 h-3" /> {day.weightKg}kg
                      </>
                    )}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-nova-700 dark:text-nova-300">{pct}%</span>
              </Card>
            </button>
          );
        })}

        {days.length === 0 && (
          <Card className="p-8 text-center text-sm text-[var(--text-muted)]">
            Your history will show up here after your first logged day.
          </Card>
        )}
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected ? formatDateLabel(selected.date) : ""}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-nova-700/6 py-3">
                <p className="text-lg font-display font-semibold">{completionPercent(foods, selected)}%</p>
                <p className="text-[11px] text-[var(--text-muted)]">completed</p>
              </div>
              <div className="rounded-xl bg-nova-700/6 py-3">
                <p className="text-lg font-display font-semibold">{computeTotals(foods, selected).calories}</p>
                <p className="text-[11px] text-[var(--text-muted)]">kcal</p>
              </div>
              <div className="rounded-xl bg-nova-700/6 py-3">
                <p className="text-lg font-display font-semibold">{selected.weightKg ?? "—"}</p>
                <p className="text-[11px] text-[var(--text-muted)]">kg</p>
              </div>
            </div>
            <div className="space-y-2">
              {foods
                .filter((f) => !f.archived)
                .map((f) => {
                  const log = selected.logs.find((l) => l.foodId === f.id);
                  const p = foodProgress(f, log?.loggedQuantity ?? 0);
                  return (
                    <div key={f.id} className="flex items-center gap-3 py-1.5">
                      <span className="text-lg"><AppIcon name={f.emoji} className="w-[18px] h-[18px]" /></span>
                      <span className="flex-1 text-sm">{f.name}</span>
                      <span className={`text-xs font-medium ${p >= 1 ? "text-nova-600 dark:text-nova-300" : "text-[var(--text-muted)]"}`}>
                        {p >= 1 ? "done" : `${Math.round(p * 100)}%`}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function RingBadge({ pct }: { pct: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" className="-rotate-90 shrink-0">
      <circle cx="20" cy="20" r={r} strokeWidth="4" className="fill-none stroke-nova-100 dark:stroke-nova-900" />
      <circle
        cx="20"
        cy="20"
        r={r}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        stroke={pct >= 80 ? "#7c5cf0" : "#2ecfdd"}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
      />
    </svg>
  );
}
