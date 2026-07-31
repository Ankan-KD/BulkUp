"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { EditableNumber } from "@/components/ui/editable-number";
import { BulkUp } from "@/components/BulkUp";
import { FoodTemplate, GoalMode } from "@/lib/types";
import { GOAL_DESCRIPTIONS, GOAL_LABELS, onboardingCta, suggestedCalorieGoal, goalWeightWarning, calorieGoalWarning } from "@/lib/goalCopy";
import { AppIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Equal, AlertTriangle } from "lucide-react";

const GOAL_ICONS: Record<GoalMode, typeof TrendingUp> = {
  gain: TrendingUp,
  lose: TrendingDown,
  maintain: Equal,
};

const SUGGESTIONS: Array<Omit<FoodTemplate, "id" | "sortOrder" | "archived" | "activeDays" | "dateOnly" | "category" | "customCategory" | "baseIngredient">> = [
  { name: "Eggs", emoji: "Egg", targetQuantity: 4, unit: "count", calories: 70, protein: 6, carbs: 0.5, fats: 5, aliases: ["egg"], kind: "quantity" },
  { name: "Milk", emoji: "Milk", targetQuantity: 500, unit: "ml", calories: 0.62, protein: 0.034, carbs: 0.05, fats: 0.033, aliases: [], kind: "quantity" },
  { name: "Chicken", emoji: "Drumstick", targetQuantity: 300, unit: "g", calories: 1.65, protein: 0.31, carbs: 0, fats: 0.036, aliases: ["chicken breast"], kind: "quantity" },
  { name: "Rice", emoji: "Wheat", targetQuantity: 300, unit: "g", calories: 1.3, protein: 0.027, carbs: 0.28, fats: 0.003, aliases: [], kind: "quantity" },
  { name: "Protein Shake", emoji: "CupSoda", targetQuantity: 1, unit: "serving", calories: 480, protein: 40, carbs: 45, fats: 12, aliases: ["shake", "whey"], kind: "binary" },
  { name: "Oats", emoji: "Wheat", targetQuantity: 100, unit: "g", calories: 3.9, protein: 0.13, carbs: 0.66, fats: 0.07, aliases: ["oatmeal"], kind: "quantity" },
  { name: "Peanut Butter", emoji: "Nut", targetQuantity: 2, unit: "count", calories: 95, protein: 3.5, carbs: 3, fats: 8, aliases: ["pb"], kind: "quantity" },
  { name: "Bananas", emoji: "Banana", targetQuantity: 2, unit: "count", calories: 105, protein: 1.3, carbs: 27, fats: 0.4, aliases: ["banana"], kind: "quantity" },
];

const SUGGESTION_CATEGORY: Record<string, FoodTemplate["category"]> = {
  Eggs: "protein",
  Milk: "dairy",
  Chicken: "protein",
  Rice: "grain",
  "Protein Shake": "protein",
  Oats: "grain",
  "Peanut Butter": "fat",
  Bananas: "fruit",
};

const SUGGESTION_BASE_INGREDIENT: Record<string, string> = {
  Eggs: "egg",
  Milk: "milk",
  Chicken: "chicken",
  Rice: "rice",
  "Protein Shake": "protein shake",
  Oats: "oats",
  "Peanut Butter": "peanut butter",
  Bananas: "banana",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { updateSettings, addFood, addWeightEntry, foods, settings } = useStore();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<GoalMode>(settings.goalMode || "gain");
  const [name, setName] = useState(settings.name || (user?.user_metadata?.name as string) || "");
  const [currentWeight, setCurrentWeight] = useState(70);
  const [calorieGoal, setCalorieGoal] = useState(() => suggestedCalorieGoal(70, settings.goalMode || "gain"));
  const [calorieGoalTouched, setCalorieGoalTouched] = useState(false);
  const [goalWeight, setGoalWeight] = useState(80);
  const [proteinGoal, setProteinGoal] = useState(180);
  const [chosen, setChosen] = useState<string[]>(["Eggs", "Milk", "Chicken", "Protein Shake"]);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  // Keep the suggested calorie target in step with weight/goal changes until
  // the user manually adjusts it themselves.
  useEffect(() => {
    if (!calorieGoalTouched) setCalorieGoal(suggestedCalorieGoal(currentWeight, goal));
  }, [currentWeight, goal, calorieGoalTouched]);

  function toggleFood(n: string) {
    setChosen((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c, n]));
  }

  function finish() {
    setSaving(true);
    updateSettings({
      name,
      goalMode: goal,
      calorieGoal,
      goalWeightKg: goalWeight,
      startWeightKg: currentWeight,
      proteinGoal,
      onboarded: true,
    });
    addWeightEntry(currentWeight);
    if (foods.length === 0) {
      SUGGESTIONS.filter((s) => chosen.includes(s.name)).forEach((s) => {
        addFood({
          ...s,
          archived: false,
          activeDays: [0, 1, 2, 3, 4, 5, 6],
          dateOnly: null,
          category: SUGGESTION_CATEGORY[s.name] ?? "other",
          customCategory: "",
          baseIngredient: SUGGESTION_BASE_INGREDIENT[s.name] ?? s.name.toLowerCase(),
          targetQuantity: targets[s.name] ?? s.targetQuantity,
        });
      });
    }
    router.replace("/");
  }

  const progress = ((step + 1) / 5) * 100;
  const weightWarning = goalWeightWarning(goal, currentWeight, goalWeight);
  const calorieWarning = calorieGoalWarning(currentWeight, goal, calorieGoal);

  return (
    <div className="min-h-dvh flex flex-col px-6 pt-10 pb-8">
      <div className="h-1 w-full rounded-full bg-nova-700/15 mb-8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-nova-500 to-aurora-400 shadow-glow-nova transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {step === 0 && (
        <div className="flex-1 flex flex-col animate-grow-in">
          <BulkUp progress={0.15} className="w-16 h-16 mb-4" />
          <h1 className="font-display text-3xl font-semibold mb-1">What&apos;s your goal?</h1>
          <p className="text-[var(--text-muted)] text-sm mb-8">This shapes your targets and daily checklist — you can change it anytime in Settings.</p>

          <div className="space-y-2.5">
            {(["gain", "lose", "maintain"] as GoalMode[]).map((g) => {
              const Icon = GOAL_ICONS[g];
              return (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl2 border px-4 py-3.5 text-left transition-all",
                    goal === g
                      ? "bg-nova-600 border-nova-500 text-white shadow-glow-nova"
                      : "border-[var(--border)] bg-[var(--bg-elevated)]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      goal === g ? "bg-white/15" : "bg-nova-700/12"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{GOAL_LABELS[g]}</span>
                    <span className={cn("block text-xs", goal === g ? "text-white/80" : "text-[var(--text-muted)]")}>
                      {GOAL_DESCRIPTIONS[g]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-8">
            <Button size="lg" className="w-full" onClick={() => setStep(1)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 flex flex-col animate-grow-in">
          <h1 className="font-display text-3xl font-semibold mb-1">Let&apos;s set your goals</h1>
          <p className="text-[var(--text-muted)] text-sm mb-8">A few numbers, then we get out of your way.</p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">What should we call you?</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 outline-none focus:border-nova-500"
              />
            </div>
            <GoalStepper label="Current weight" value={currentWeight} step={0.5} suffix="kg" onChange={setCurrentWeight} />
            <GoalStepper label="Goal weight" value={goalWeight} step={1} suffix="kg" onChange={setGoalWeight} />
            {weightWarning && (
              <div className="flex items-start gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3.5 py-3 text-xs text-ember-600">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{weightWarning}</span>
              </div>
            )}
          </div>

          <div className="mt-auto pt-8 flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex-1 flex flex-col animate-grow-in">
          <h1 className="font-display text-3xl font-semibold mb-1">Daily targets</h1>
          <p className="text-[var(--text-muted)] text-sm mb-8">Calories and protein — you can tune these anytime.</p>

          <div className="space-y-6">
            <GoalStepper
              label="Daily calorie goal"
              value={calorieGoal}
              step={100}
              suffix="kcal"
              onChange={(v) => {
                setCalorieGoal(v);
                setCalorieGoalTouched(true);
              }}
            />
            <GoalStepper label="Protein goal" value={proteinGoal} step={10} suffix="g" onChange={setProteinGoal} />
            {calorieWarning && (
              <div className="flex items-start gap-2 rounded-xl border border-ember-500/30 bg-ember-500/10 px-3.5 py-3 text-xs text-ember-600">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{calorieWarning}</span>
              </div>
            )}
          </div>

          <div className="mt-auto pt-8 flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex-1 flex flex-col animate-grow-in">
          <h1 className="font-display text-3xl font-semibold mb-1">What foods do you regularly eat?</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">Pick a few to start — you can add more anytime.</p>

          <div className="grid grid-cols-2 gap-2.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.name}
                onClick={() => toggleFood(s.name)}
                className={cn(
                  "flex items-center gap-2 rounded-xl2 border px-3.5 py-3 text-left transition-all",
                  chosen.includes(s.name)
                    ? "bg-nova-600 border-nova-500 text-white shadow-glow-nova"
                    : "border-[var(--border)] bg-[var(--bg-elevated)]"
                )}
              >
                <span className="text-xl"><AppIcon name={s.emoji} className="w-5 h-5" /></span>
                <span className="text-sm font-medium">{s.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-8 flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setStep(4)} disabled={chosen.length === 0}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex-1 flex flex-col animate-grow-in">
          <h1 className="font-display text-3xl font-semibold mb-1">Set your daily targets</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">How much of each, per day?</p>

          <div className="space-y-3 overflow-y-auto no-scrollbar">
            {SUGGESTIONS.filter((s) => chosen.includes(s.name)).map((s) => (
              <div key={s.name} className="flex items-center gap-3 rounded-xl2 border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3">
                <span className="text-xl"><AppIcon name={s.emoji} className="w-5 h-5" /></span>
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setTargets((t) => ({
                        ...t,
                        [s.name]: Math.max(0, (t[s.name] ?? s.targetQuantity) - (s.unit === "g" || s.unit === "ml" ? 50 : 1)),
                      }))
                    }
                    className="h-7 w-7 rounded-full bg-nova-700/12 flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="w-16 flex items-center justify-center gap-0.5 text-sm tabular-nums font-semibold">
                    <EditableNumber
                      value={targets[s.name] ?? s.targetQuantity}
                      onChange={(v) => setTargets((t) => ({ ...t, [s.name]: Math.max(0, v) }))}
                      ariaLabel={`${s.name} target quantity`}
                      className="w-10 bg-transparent"
                    />
                    {s.unit === "count" ? "" : s.unit === "serving" ? " svg" : s.unit}
                  </span>
                  <button
                    onClick={() =>
                      setTargets((t) => ({
                        ...t,
                        [s.name]: (t[s.name] ?? s.targetQuantity) + (s.unit === "g" || s.unit === "ml" ? 50 : 1),
                      }))
                    }
                    className="h-7 w-7 rounded-full bg-nova-700/12 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-8 flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" onClick={finish} disabled={saving}>
              {saving ? "Starting…" : onboardingCta(goal)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function GoalStepper({
  label,
  value,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
        <button
          onClick={() => onChange(Math.max(0, Math.round((value - step) * 10) / 10))}
          className="h-9 w-9 rounded-full bg-nova-700/12 flex items-center justify-center active:scale-90 transition-transform"
        >
          −
        </button>
        <span className="text-lg font-display font-semibold tabular-nums flex items-baseline gap-1">
          <EditableNumber
            value={value}
            onChange={(v) => onChange(Math.max(0, v))}
            decimals={1}
            ariaLabel={label}
            className="w-14 bg-transparent"
          />
          <span className="text-sm font-body font-normal text-[var(--text-muted)]">{suffix}</span>
        </span>
        <button
          onClick={() => onChange(Math.round((value + step) * 10) / 10)}
          className="h-9 w-9 rounded-full bg-nova-700/12 flex items-center justify-center active:scale-90 transition-transform"
        >
          +
        </button>
      </div>
    </div>
  );
}
