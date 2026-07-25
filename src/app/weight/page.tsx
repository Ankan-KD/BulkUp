"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, Scale } from "lucide-react";

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
          <TrendingUp className="w-4 h-4" /> {gained >= 0 ? "+" : ""}{gained} kg gained since start
        </p>
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
            <div className="flex items-end gap-1 h-24">
              {filtered.map((w, i) => {
                const h = ((w.weightKg - minW) / spread) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-[2px]">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-nova-700 to-aurora-400 shadow-glow-nova"
                      style={{ height: `${Math.max(6, h)}%` }}
                      title={`${w.weightKg}kg on ${w.date}`}
                    />
                  </div>
                );
              })}
            </div>
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