"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Target, Scale, Sparkles } from "lucide-react";
import { weightTrendLabel } from "@/lib/goalCopy";
import { computeRollingAverage, computeWeeklyRateKg, interpretProgress } from "@/lib/weightTrend";

type Range = "7d" | "30d" | "3m" | "6m";
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "3m": 90, "6m": 180 };
const RANGE_LABEL: Record<Range, string> = { "7d": "7D", "30d": "30D", "3m": "3M", "6m": "6M" };

export default function WeightPage() {
  const { settings, weights, addWeightEntry } = useStore();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [range, setRange] = useState<Range>("30d");

  const current = weights.length > 0 ? weights[weights.length - 1].weightKg : settings.startWeightKg;
  const gained = Math.round((current - settings.startWeightKg) * 10) / 10;
  const toGoal = Math.round((settings.goalWeightKg - current) * 10) / 10;

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    return weights.filter((w) => w.date >= cutoffISO);
  }, [weights, range]);

  const maxW = filtered.length ? Math.max(...filtered.map((w) => w.weightKg)) : settings.goalWeightKg;
  const minW = filtered.length ? Math.min(...filtered.map((w) => w.weightKg)) : settings.startWeightKg;
  const spread = Math.max(1, maxW - minW);

  const rangeChange =
    filtered.length > 1
      ? Math.round((filtered[filtered.length - 1].weightKg - filtered[0].weightKg) * 10) / 10
      : null;

  // ── Phase 6: 7-day rolling average, weekly rate of change, and a plain
  // -language read on whether the current plan is working. Computed on the
  // full history (not the selected chart range) so it stays a stable,
  // range-independent read of "how am I trending right now".
  const rollingSeries = useMemo(() => computeRollingAverage(weights, 7), [weights]);
  const latestAvg = rollingSeries.length ? rollingSeries[rollingSeries.length - 1].avgKg : current;
  const weeklyRateKg = useMemo(() => computeWeeklyRateKg(weights, 28), [weights]);
  const progress = useMemo(
    () => interpretProgress(settings.goalMode, weeklyRateKg, current, settings.goalWeightKg),
    [settings.goalMode, weeklyRateKg, current, settings.goalWeightKg]
  );
  // Same rolling series, cropped to the chart's selected range — the line
  // we actually draw, since raw daily bars are prone to noisy fluctuation.
  const rollingFiltered = useMemo(() => {
    if (filtered.length === 0) return [];
    const cutoffISO = filtered[0].date;
    return rollingSeries.filter((p) => p.date >= cutoffISO);
  }, [rollingSeries, filtered]);

  function save() {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      addWeightEntry(num);
      setValue("");
      setOpen(false);
    }
  }

  return (
    <div className="px-5 pt-6">
      <header className="mb-5">
        <p className="text-sm text-[var(--text-muted)]">Your journey</p>
        <h1 className="font-display text-2xl font-semibold">Weight</h1>
      </header>

      <Card className="p-6 mb-4 text-center relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-aurora-200/30 dark:bg-aurora-900/10 blur-2xl" />
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-1">Current weight</p>
        <p className="font-display text-4xl font-semibold tabular-nums">{current}<span className="text-lg font-body text-[var(--text-muted)]"> kg</span></p>
        <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-nova-400">
          {(settings.goalMode === "lose" ? gained <= 0 : gained >= 0) ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}{" "}
          {weightTrendLabel(settings.goalMode, gained)}
        </p>
      </Card>

      {/* Trend & progress interpretation (Phase 6) — the headline read on
          whether the current plan is working, prioritized above raw
          daily-entry stats since that's what actually answers the question. */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">7-day average</p>
            <p className="font-display text-xl font-semibold tabular-nums mt-0.5">
              {latestAvg}
              <span className="text-sm font-body font-normal text-[var(--text-muted)]"> kg</span>
            </p>
          </div>
          <div className="w-px h-9 bg-[var(--border)]" />
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Weekly rate</p>
            <p
              className={cn(
                "font-display text-xl font-semibold tabular-nums mt-0.5 inline-flex items-center gap-1",
                weeklyRateKg === null || Math.abs(weeklyRateKg) < 0.1
                  ? "text-[var(--text)]"
                  : weeklyRateKg > 0
                  ? "text-nova-400"
                  : "text-aurora-400"
              )}
            >
              {weeklyRateKg !== null && Math.abs(weeklyRateKg) >= 0.1 ? (
                weeklyRateKg > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )
              ) : (
                <Minus className="w-4 h-4" />
              )}
              {weeklyRateKg !== null ? `${weeklyRateKg > 0 ? "+" : ""}${weeklyRateKg}` : "—"}
              <span className="text-sm font-body font-normal text-[var(--text-muted)]">kg/wk</span>
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-aurora-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] leading-snug">{progress.headline}</p>
            {progress.detail && <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{progress.detail}</p>}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <Card className="p-4">
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
            <Target className="w-3.5 h-3.5" /> Goal weight
          </span>
          <p className="font-display text-xl font-semibold tabular-nums">{settings.goalWeightKg} kg</p>
        </Card>
        <Card className="p-4">
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1">
            <Scale className="w-3.5 h-3.5" /> To go
          </span>
          <p className="font-display text-xl font-semibold tabular-nums">{Math.max(0, toGoal)} kg</p>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-[var(--text-muted)]">
            {filtered.length > 0 ? `${filtered.length} entr${filtered.length === 1 ? "y" : "ies"}` : "No entries yet"}
            {rangeChange !== null && (
              <span className={cn("ml-2 font-medium", rangeChange >= 0 ? "text-nova-400" : "text-aurora-400")}>
                {rangeChange >= 0 ? <TrendingUp className="inline w-3 h-3 -mt-0.5" /> : <TrendingDown className="inline w-3 h-3 -mt-0.5" />}{" "}
                {rangeChange >= 0 ? "+" : ""}{rangeChange} kg
              </span>
            )}
          </p>
          <div className="flex rounded-lg border border-[var(--border)] p-0.5">
            {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors",
                  range === r ? "bg-nova-600 text-white shadow-glow-nova" : "text-[var(--text-muted)]"
                )}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 1 ? (
          <>
            <svg viewBox="0 0 300 100" className="w-full h-24" preserveAspectRatio="none">
              <defs>
                <linearGradient id="weightTrendLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#5a32c9" />
                  <stop offset="100%" stopColor="#2ecfdd" />
                </linearGradient>
              </defs>
              {(() => {
                const n = rollingFiltered.length || filtered.length;
                const xFor = (i: number) => (n <= 1 ? 150 : (i / (n - 1)) * 300);
                const yFor = (v: number) => 92 - ((v - minW) / spread) * 84;
                const linePoints = rollingFiltered.length ? rollingFiltered : filtered.map((w) => ({ avgKg: w.weightKg }));
                const path = linePoints
                  .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(p.avgKg)}`)
                  .join(" ");
                return (
                  <>
                    {/* raw daily entries — kept subtle on purpose, the average line is the point */}
                    {filtered.map((w, i) => (
                      <circle
                        key={i}
                        cx={xFor(i)}
                        cy={yFor(w.weightKg)}
                        r={1.6}
                        className="fill-nova-700/25 dark:fill-nova-100/20"
                      />
                    ))}
                    {/* 7-day rolling average — the primary trend visualization */}
                    <path
                      d={path}
                      fill="none"
                      stroke="url(#weightTrendLine)"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {linePoints.length > 0 && (
                      <circle
                        cx={xFor(linePoints.length - 1)}
                        cy={yFor(linePoints[linePoints.length - 1].avgKg)}
                        r={3}
                        className="fill-aurora-400"
                      />
                    )}
                  </>
                );
              })()}
            </svg>
            <div className="flex justify-between mt-2 text-[10px] text-[var(--text-muted)]">
              <span>{formatDateShort(filtered[0].date)}</span>
              <span>{formatDateShort(filtered[filtered.length - 1].date)}</span>
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">
            {filtered.length === 1
              ? "Log one more weigh-in to see your trend here."
              : "No weigh-ins in this range yet — log your weight to start the chart."}
          </p>
        )}
      </Card>

      <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
        Update weight
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Update weight">
        <div className="space-y-4">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`${current}`}
            className="w-full text-center text-3xl font-display font-semibold rounded-xl border border-[var(--border)] bg-[var(--bg)] py-4 outline-none focus:border-nova-500"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <p className="text-center text-sm text-[var(--text-muted)]">kilograms</p>
          <Button className="w-full" size="lg" onClick={save} disabled={!value}>
            Save
          </Button>
        </div>
      </Sheet>
    </div>
  );
}