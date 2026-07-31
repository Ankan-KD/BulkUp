"use client";

import { useState } from "react";
import { FoodTemplate } from "@/lib/types";
import { FoodIcon, getCategoryStyle } from "@/lib/icons";
import { useStore } from "@/lib/store";
import { foodProgress } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { Check, Minus, Plus } from "lucide-react";
import { EditableNumber } from "./ui/editable-number";

export function FoodChecklistItem({
  food,
  loggedQuantity,
}: {
  food: FoodTemplate;
  loggedQuantity: number;
}) {
  const { toggleBinary, logQuantity } = useStore();
  const [expanded, setExpanded] = useState(false);
  const progress = foodProgress(food, loggedQuantity);
  const done = progress >= 1;
  const step = food.unit === "g" || food.unit === "ml" ? 50 : 1;
  const style = getCategoryStyle(food.category);

  if (food.kind === "binary") {
    return (
      <button
        onClick={() => toggleBinary(food.id)}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl2 border border-l-[3px] px-4 py-1.5 shadow-soft transition-all duration-150 active:scale-[0.98] text-left",
          style.accentBorder,
          done
            ? "bg-emerald-500/[0.07] border-emerald-500/40 dark:bg-emerald-400/10"
            : cn("glass-panel border-[var(--border)]", style.cardTint)
        )}
      >
        <Checkbox done={done} />
        <FoodIcon iconKey={food.emoji} category={food.category} size="xl" variant="plain" />
        <span className={cn("flex-1 font-medium text-[15px]", done && "line-through decoration-2 text-[var(--text-muted)]")}>
          {food.name}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {done ? "done" : `${food.targetQuantity} ${food.unit === "serving" ? "serving" : food.unit}`}
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl2 border border-l-[3px] px-4 py-1.5 shadow-soft transition-colors duration-150",
        style.accentBorder,
        done ? "bg-emerald-500/[0.07] border-emerald-500/40 dark:bg-emerald-400/10" : cn("glass-panel border-[var(--border)]", style.cardTint)
      )}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 text-left"
      >
        <Checkbox done={done} progress={progress} />
        <FoodIcon iconKey={food.emoji} category={food.category} size="xl" variant="plain" />
        <span className={cn("flex-1 font-medium text-[15px]", done && "text-[var(--text)]")}>
          {food.name}
        </span>
        <span className="text-xs font-medium tabular-nums text-[var(--text-muted)]">
          {done ? "100%" : `${Math.round(progress * 100)}%`}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 pb-2 border-t border-[var(--border)] animate-grow-in">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              onClick={() => logQuantity(food.id, Math.max(0, loggedQuantity - step))}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-nova-700/8 dark:bg-nova-100/10 active:scale-90 transition-transform"
              aria-label={`Remove ${step}${food.unit}`}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-base font-semibold tabular-nums font-display flex items-baseline">
              <EditableNumber
                value={loggedQuantity}
                onChange={(v) => logQuantity(food.id, Math.max(0, v))}
                ariaLabel={`${food.name} logged quantity`}
                className="w-10 bg-transparent"
              />
              <span className="text-sm font-body font-normal text-[var(--text-muted)]"> / {food.targetQuantity}{food.unit}</span>
            </span>
            <button
              onClick={() => logQuantity(food.id, loggedQuantity + step)}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-nova-700/8 dark:bg-nova-100/10 active:scale-90 transition-transform"
              aria-label={`Add ${step}${food.unit}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => logQuantity(food.id, Math.round((food.targetQuantity * pct) / 100))}
                className={cn(
                  "text-xs py-1.5 rounded-lg font-medium transition-colors",
                  Math.round(progress * 100) === pct
                    ? "bg-nova-700 text-white"
                    : "bg-nova-700/8 dark:bg-nova-100/10 text-[var(--text-muted)]"
                )}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Checkbox({ done, progress }: { done: boolean; progress?: number }) {
  if (done) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white animate-pop">
        <Check className="w-3.5 h-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (progress && progress > 0) {
    return (
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-nova-300 dark:border-nova-600">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10"
            strokeWidth="3"
            fill="none"
            className="stroke-nova-500"
            strokeDasharray={2 * Math.PI * 10}
            strokeDashoffset={2 * Math.PI * 10 * (1 - progress)}
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }
  return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-[var(--border)]" />;
}
