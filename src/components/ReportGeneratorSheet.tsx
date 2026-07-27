"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { DayRecord, WeightEntry } from "@/lib/types";
import { REPORT_PERIOD_OPTIONS, ReportPeriodKey, resolvePeriod, periodRangeLabel } from "@/lib/reportPeriod";
import { buildReportData } from "@/lib/reportData";
import { fetchDayRecordsForRange } from "@/lib/reportFetch";
import { buildHealthReportPdf } from "@/lib/pdfReport";
import { FileText, Loader2, Sparkles } from "lucide-react";

export function ReportGeneratorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { foods, history, today, weights, milestones, settings } = useStore();
  const { user } = useAuth();

  const [periodKey, setPeriodKey] = useState<ReportPeriodKey>("last30");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const todayISOStr = today.date;

  const previewPeriod = useMemo(
    () => resolvePeriod(periodKey, customStart || undefined, customEnd || undefined),
    [periodKey, customStart, customEnd]
  );

  const isCustomIncomplete = periodKey === "custom" && (!customStart || !customEnd);

  async function handleGenerate() {
    if (isCustomIncomplete) return;
    setStatus("generating");
    setStatusMessage("Gathering your data…");

    try {
      const period = resolvePeriod(periodKey, customStart || undefined, customEnd || undefined);

      // Merge whatever is already loaded in the store...
      const localDays: DayRecord[] = [...history, today];
      let allDays = localDays;
      let allWeights: WeightEntry[] = weights;

      // ...then backfill anything outside the store's cached window (older
      // than ~120 days) straight from Supabase, if needed and available.
      const loadedDates = new Set(localDays.map((d) => d.date));
      const needsBackfill = period.startISO < (localDays[0]?.date ?? todayISOStr) && user;
      if (needsBackfill && user) {
        setStatusMessage("Fetching older history…");
        const { days: fetchedDays, weights: fetchedWeights } = await fetchDayRecordsForRange(
          user.id,
          period.startISO,
          period.endISO
        );
        const extra = fetchedDays.filter((d) => !loadedDates.has(d.date));
        allDays = [...localDays, ...extra];
        const weightDates = new Set(allWeights.map((w) => w.date));
        allWeights = [...allWeights, ...fetchedWeights.filter((w) => !weightDates.has(w.date))];
      }

      setStatusMessage("Crunching the numbers…");
      const reportData = buildReportData({
        period,
        foods,
        allDays,
        weights: allWeights,
        milestones,
        settings,
        userName: settings.name,
        userEmail: user?.email ?? "",
      });

      setStatusMessage("Writing AI insights…");
      const topFoods = reportData.foods.slice(0, 5).map((f) => f.name);
      let aiBullets: string[] = [];
      try {
        const res = await fetch("/api/health-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goalMode: settings.goalMode,
            periodLabel: periodRangeLabel(period),
            daysIncluded: reportData.summary.daysIncluded,
            daysTracked: reportData.summary.daysTracked,
            avgCalories: reportData.summary.avgCalories,
            calorieGoal: settings.calorieGoal,
            avgProtein: reportData.summary.avgProtein,
            proteinGoal: settings.proteinGoal,
            avgCarbs: reportData.summary.avgCarbs,
            avgFats: reportData.summary.avgFats,
            avgWaterMl: reportData.summary.avgWaterMl,
            waterGoalMl: settings.waterGoalMl,
            waterCompletionPct: reportData.water.completionPct,
            consistencyScore: reportData.summary.consistencyScore,
            daysGoalAchieved: reportData.summary.daysGoalAchieved,
            startWeightKg: reportData.weight.startWeightKg,
            endWeightKg: reportData.weight.endWeightKg,
            changeKg: reportData.weight.changeKg,
            goalWeightKg: settings.goalWeightKg,
            topFoods,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.bullets)) aiBullets = json.bullets;
        }
      } catch {
        // Fall through to a minimal local summary below.
      }
      if (aiBullets.length === 0) {
        aiBullets = [
          `You met your calorie goal on ${reportData.summary.daysGoalAchieved} of ${reportData.summary.daysIncluded} days.`,
          `Protein intake averaged ${reportData.summary.avgProtein}g/day.`,
          reportData.weight.changeKg !== null
            ? `Your weight changed by ${reportData.weight.changeKg >= 0 ? "+" : ""}${reportData.weight.changeKg}kg this period.`
            : "No weight entries were logged during this period.",
          `Your overall consistency score was ${reportData.summary.consistencyScore}%.`,
        ];
      }

      setStatusMessage("Building your PDF…");
      const doc = buildHealthReportPdf({ data: reportData, aiBullets });
      const fileSafeLabel = periodRangeLabel(period).replace(/[^\w-]+/g, "_");
      doc.save(`BodyBuddy-Report-${fileSafeLabel}.pdf`);

      setStatus("idle");
      setStatusMessage("");
      onClose();
    } catch (err) {
      console.error("Report generation failed", err);
      setStatus("error");
      setStatusMessage("Something went wrong generating the report. Please try again.");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Health & Nutrition Report">
      <div className="space-y-5">
        <p className="text-sm text-[var(--text-muted)]">
          Generate a professionally formatted PDF you can keep for your own records or share with a coach,
          nutritionist, or trainer.
        </p>

        <div>
          <p className="text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wide">
            Select Report Period
          </p>
          <div className="grid grid-cols-2 gap-2">
            {REPORT_PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriodKey(opt.key)}
                className={`text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  periodKey === opt.key
                    ? "bg-nova-500/10 border-nova-500/40 text-nova-700 dark:text-nova-300"
                    : "border-[var(--border)] text-[var(--text)] hover:bg-nova-700/6 dark:hover:bg-nova-100/6"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {periodKey === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-xs text-[var(--text-muted)] mb-1">Start date</span>
              <input
                type="date"
                value={customStart}
                max={todayISOStr}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-[var(--text-muted)] mb-1">End date</span>
              <input
                type="date"
                value={customEnd}
                max={todayISOStr}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-sm"
              />
            </label>
          </div>
        )}

        <div className="rounded-xl bg-nova-700/6 dark:bg-nova-100/6 px-4 py-3 text-sm flex items-center justify-between">
          <span className="text-[var(--text-muted)]">Report will cover</span>
          <span className="font-medium">{isCustomIncomplete ? "Pick both dates" : periodRangeLabel(previewPeriod)}</span>
        </div>

        {status === "error" && <p className="text-sm text-ember-600 dark:text-ember-400">{statusMessage}</p>}

        <Button
          onClick={handleGenerate}
          disabled={status === "generating" || isCustomIncomplete}
          className="w-full"
          size="lg"
        >
          {status === "generating" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {statusMessage || "Generating…"}
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Generate PDF
            </>
          )}
        </Button>

        <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 shrink-0" />
          Includes an AI-generated insights page summarizing your progress for this period.
        </p>
      </div>
    </Sheet>
  );
}
