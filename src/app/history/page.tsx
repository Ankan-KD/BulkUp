"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { computeTotals, completionPercent, foodProgress } from "@/lib/nutrition";
import { formatDateLabel } from "@/lib/utils";
import { DayRecord } from "@/lib/types";
import { AppIcon } from "@/lib/icons";
import { WeeklySummary } from "@/components/WeeklySummary";
import { StreaksAchievements } from "@/components/StreaksAchievements";
import { ReportGeneratorSheet } from "@/components/ReportGeneratorSheet";
import { Flame, Scale as ScaleIcon, FileText } from "lucide-react";

export default function HistoryPage() {
  const { foods, history, today } = useStore();
  const [selected, setSelected] = useState<DayRecord | null>(null);
  const [view, setView] = useState<"daily" | "weekly" | "progress">("daily");
  const [reportOpen, setReportOpen] = useState(false);

  const days = useMemo(
    () => [...history, today].filter((d) => d.logs.length > 0 || d.weightKg).reverse(),
    [history, today]
  );

  return (
    <div className="px-5 pt-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--text-muted)]">Consistency over time</p>
          <h1 className="font-display text-2xl font-semibold">History</h1>
        </div>
        <button
          onClick={() => setReportOpen(true)}
          className="shrink-0 mt-1 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-medium shadow-soft hover:bg-nova-700/6 dark:hover:bg-nova-100/6 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          Download Report
        </button>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-1.5 rounded-xl2 bg-nova-700/6 dark:bg-nova-100/6 p-1">
        {(["daily", "weekly", "progress"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              view === v ? "bg-[var(--bg-elevated)] shadow-soft text-[var(--text)]" : "text-[var(--text-muted)]"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "weekly" ? (
        <WeeklySummary />
      ) : view === "progress" ? (
        <StreaksAchievements />
      ) : (
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
                <span className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">{pct}%</span>
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
      )}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected ? formatDateLabel(selected.date) : ""}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-blue-500/[0.06] dark:bg-blue-400/[0.08] py-3">
                <p className="text-lg font-display font-semibold text-blue-600 dark:text-blue-400">{completionPercent(foods, selected)}%</p>
                <p className="text-[11px] text-[var(--text-muted)]">completed</p>
              </div>
              <div className="rounded-xl bg-orange-500/[0.06] dark:bg-orange-400/[0.08] py-3">
                <p className="text-lg font-display font-semibold text-orange-600 dark:text-orange-400">{computeTotals(foods, selected).calories}</p>
                <p className="text-[11px] text-[var(--text-muted)]">kcal</p>
              </div>
              <div className="rounded-xl bg-nova-700/6 dark:bg-nova-100/6 py-3">
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
                      <span className={`text-xs font-medium ${p >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-muted)]"}`}>
                        {p >= 1 ? "done" : `${Math.round(p * 100)}%`}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </Sheet>

      <ReportGeneratorSheet open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}

function RingBadge({ pct }: { pct: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" className="-rotate-90 shrink-0">
      <circle cx="20" cy="20" r={r} strokeWidth="4" className="fill-none stroke-blue-500/10 dark:stroke-blue-400/10" />
      <circle
        cx="20"
        cy="20"
        r={r}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        stroke={pct >= 80 ? "#10b981" : "#3b82f6"}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
      />
    </svg>
  );
}
