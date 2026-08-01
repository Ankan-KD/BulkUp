import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

/**
 * Semantic tint tokens — every feature area gets its own quiet identity
 * instead of one accent colour reused everywhere. Each tint pairs a soft
 * two-stop gradient wash with a matching hairline border so the card reads
 * as "belonging" to its category at a glance, without shouting.
 */
export const CARD_TINTS = {
  none: "",
  calories: "bg-gradient-to-br from-orange-500/[0.07] to-orange-500/[0.02] border-orange-500/15 dark:from-orange-400/[0.10] dark:to-orange-400/[0.02] dark:border-orange-400/15",
  protein: "bg-gradient-to-br from-amber-500/[0.08] to-amber-500/[0.02] border-amber-500/15 dark:from-amber-400/[0.10] dark:to-amber-400/[0.02] dark:border-amber-400/15",
  carbs: "bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] border-emerald-500/15 dark:from-emerald-400/[0.10] dark:to-emerald-400/[0.02] dark:border-emerald-400/15",
  fat: "bg-gradient-to-br from-purple-500/[0.08] to-purple-500/[0.02] border-purple-500/15 dark:from-purple-400/[0.10] dark:to-purple-400/[0.02] dark:border-purple-400/15",
  water: "bg-gradient-to-br from-cyan-500/[0.08] to-cyan-500/[0.02] border-cyan-500/15 dark:from-cyan-400/[0.10] dark:to-cyan-400/[0.02] dark:border-cyan-400/15",
  progress: "bg-gradient-to-br from-blue-500/[0.08] to-blue-500/[0.02] border-blue-500/15 dark:from-blue-400/[0.10] dark:to-blue-400/[0.02] dark:border-blue-400/15",
  gold: "bg-gradient-to-br from-amber-400/[0.10] to-yellow-400/[0.02] border-amber-400/20 dark:from-amber-300/[0.12] dark:to-yellow-300/[0.02] dark:border-amber-300/20",
  warning: "bg-gradient-to-br from-red-500/[0.08] to-red-500/[0.02] border-red-500/15 dark:from-red-400/[0.10] dark:to-red-400/[0.02] dark:border-red-400/15",
} as const;

export type CardTint = keyof typeof CARD_TINTS;

export function Card({
  className,
  tint = "none",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tint?: CardTint }) {
  return (
    <div
      className={cn(
        "rounded-2xl border shadow-soft",
        tint === "none" ? "glass-panel" : cn("bg-[var(--bg-elevated)]", CARD_TINTS[tint]),
        className
      )}
      {...props}
    />
  );
}
