"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditableNumber } from "@/components/ui/editable-number";
import { Sun, Moon, Monitor, Heart, LogOut, Mail, TrendingUp, TrendingDown, Equal, AlertTriangle } from "lucide-react";
import { GoalMode } from "@/lib/types";
import { GOAL_SHORT_LABELS, goalWeightWarning, calorieGoalWarning } from "@/lib/goalCopy";

const GOAL_ICONS: Record<GoalMode, typeof TrendingUp> = {
  gain: TrendingUp,
  lose: TrendingDown,
  maintain: Equal,
};

export default function SettingsPage() {
  const { settings, updateSettings, weights } = useStore();
  const { user, signOut } = useAuth();
  const currentWeight = useMemo(
    () => (weights.length > 0 ? weights[weights.length - 1].weightKg : settings.startWeightKg),
    [weights, settings.startWeightKg]
  );
  const weightWarning = goalWeightWarning(settings.goalMode, currentWeight, settings.goalWeightKg);
  const calorieWarning = calorieGoalWarning(currentWeight, settings.goalMode, settings.calorieGoal);

  return (
    <div className="px-5 pt-6">
      <header className="mb-5">
        <p className="text-sm text-[var(--text-muted)]">Tune your goals</p>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
      </header>

      <Card className="p-4 mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-nova-500 to-aurora-500 shadow-glow-nova">
          <Mail className="w-4 h-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--text-muted)]">Signed in as</p>
          <p className="text-sm font-medium truncate">{user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="w-4 h-4" /> Sign out
        </Button>
      </Card>

      <Card className="p-4 mb-4">
        <p className="text-sm font-medium mb-3">Goal</p>
        <div className="grid grid-cols-3 gap-2">
          {(["gain", "lose", "maintain"] as GoalMode[]).map((g) => {
            const Icon = GOAL_ICONS[g];
            return (
              <button
                key={g}
                onClick={() => updateSettings({ goalMode: g })}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors flex flex-col items-center justify-center gap-1 ${
                  settings.goalMode === g ? "bg-nova-700 text-white border-nova-700" : "border-[var(--border)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {GOAL_SHORT_LABELS[g]}
              </button>
            );
          })}
        </div>
        {weightWarning && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3.5 py-3 text-xs text-ember-600">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{weightWarning}</span>
          </div>
        )}
      </Card>

      <Card className="p-4 mb-4 space-y-4">
        <NumberRow
          label="Daily calorie goal"
          value={settings.calorieGoal}
          suffix="kcal"
          onChange={(v) => updateSettings({ calorieGoal: v })}
        />
        {calorieWarning && (
          <div className="flex items-start gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3.5 py-3 text-xs text-ember-600">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{calorieWarning}</span>
          </div>
        )}
        <Divider />
        <NumberRow
          label="Protein goal"
          value={settings.proteinGoal}
          suffix="g"
          onChange={(v) => updateSettings({ proteinGoal: v })}
        />
        <Divider />
        <NumberRow
          label="Goal weight"
          value={settings.goalWeightKg}
          suffix="kg"
          step={0.5}
          onChange={(v) => updateSettings({ goalWeightKg: v })}
        />
        <Divider />
        <NumberRow
          label="Water goal"
          value={settings.waterGoalMl}
          suffix="ml"
          step={100}
          onChange={(v) => updateSettings({ waterGoalMl: v })}
        />
      </Card>

      <Card className="p-4 mb-4">
        <p className="text-sm font-medium mb-3">Units</p>
        <div className="flex gap-2">
          {(["metric", "imperial"] as const).map((u) => (
            <button
              key={u}
              onClick={() => updateSettings({ units: u })}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors capitalize ${
                settings.units === u ? "bg-nova-700 text-white border-nova-700" : "border-[var(--border)]"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-medium mb-3">Theme</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "light", icon: Sun },
            { key: "dark", icon: Moon },
            { key: "system", icon: Monitor },
            { key: "princess", icon: Heart },
          ].map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => updateSettings({ theme: key as typeof settings.theme })}
              className={`py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-1.5 capitalize ${
                settings.theme === key
                  ? key === "princess"
                    ? "bg-[#f4429e] text-white border-[#f4429e]"
                    : "bg-nova-700 text-white border-nova-700"
                  : "border-[var(--border)]"
              }`}
            >
              <Icon className={`w-4 h-4 ${key === "princess" && settings.theme !== "princess" ? "text-[#f4429e]" : ""}`} />{" "}
              {key}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--border)]" />;
}

function NumberRow({
  label,
  value,
  suffix,
  step = 10,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(0, value - step))}
          className="h-8 w-8 rounded-full bg-nova-700/8 dark:bg-nova-100/10 flex items-center justify-center active:scale-90 transition-transform"
        >
          −
        </button>
        <span className="w-20 flex items-baseline justify-center gap-1 text-sm tabular-nums font-semibold">
          <EditableNumber
            value={value}
            onChange={(v) => onChange(Math.max(0, v))}
            ariaLabel={label}
            className="w-12 bg-transparent"
          />
          <span className="text-[var(--text-muted)] font-normal">{suffix}</span>
        </span>
        <button
          onClick={() => onChange(value + step)}
          className="h-8 w-8 rounded-full bg-nova-700/8 dark:bg-nova-100/10 flex items-center justify-center active:scale-90 transition-transform"
        >
          +
        </button>
      </div>
    </div>
  );
}
