import type { FoodCategory } from "./types";

/**
 * One soft, elegant accent colour per food category. Kept as plain literal
 * Tailwind class strings (not template-built) so Tailwind's JIT scanner can
 * find them at build time — see the `content` globs in tailwind.config.ts,
 * which includes this file.
 *
 * Every value is intentionally low-opacity / muted so it reads as a gentle
 * tint rather than a loud badge, and every value has a matching dark-mode
 * variant tuned for the app's near-black dark background.
 */
export interface CategoryStyle {
  /** Background for the small icon badge (food rows, section headers). */
  badgeBg: string;
  /** Icon colour, paired with `badgeBg`. */
  iconColor: string;
  /** Left edge accent applied to cards/rows, alongside the default border. */
  accentBorder: string;
  /** Whisper-subtle full-card background tint. */
  cardTint: string;
  /** Background for small text chips/pills (section counts, tags). */
  chipBg: string;
  /** Text colour paired with `chipBg`. */
  chipText: string;
  /** Ring colour for selected-state outlines (e.g. category/icon pickers). */
  ring: string;
}

export const CATEGORY_STYLES: Record<FoodCategory, CategoryStyle> = {
  protein: {
    badgeBg: "bg-rose-500/12 dark:bg-rose-400/15",
    iconColor: "text-rose-600 dark:text-rose-300",
    accentBorder: "border-l-rose-500/50 dark:border-l-rose-400/50",
    cardTint: "bg-rose-500/[0.035] dark:bg-rose-400/[0.05]",
    chipBg: "bg-rose-500/10 dark:bg-rose-400/12",
    chipText: "text-rose-600 dark:text-rose-300",
    ring: "ring-rose-500/50 dark:ring-rose-400/50",
  },
  grain: {
    badgeBg: "bg-amber-500/12 dark:bg-amber-400/15",
    iconColor: "text-amber-600 dark:text-amber-300",
    accentBorder: "border-l-amber-500/50 dark:border-l-amber-400/50",
    cardTint: "bg-amber-500/[0.035] dark:bg-amber-400/[0.05]",
    chipBg: "bg-amber-500/10 dark:bg-amber-400/12",
    chipText: "text-amber-600 dark:text-amber-300",
    ring: "ring-amber-500/50 dark:ring-amber-400/50",
  },
  vegetable: {
    badgeBg: "bg-emerald-500/12 dark:bg-emerald-400/15",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    accentBorder: "border-l-emerald-500/50 dark:border-l-emerald-400/50",
    cardTint: "bg-emerald-500/[0.035] dark:bg-emerald-400/[0.05]",
    chipBg: "bg-emerald-500/10 dark:bg-emerald-400/12",
    chipText: "text-emerald-600 dark:text-emerald-300",
    ring: "ring-emerald-500/50 dark:ring-emerald-400/50",
  },
  fruit: {
    badgeBg: "bg-pink-500/12 dark:bg-pink-400/15",
    iconColor: "text-pink-600 dark:text-pink-300",
    accentBorder: "border-l-pink-500/50 dark:border-l-pink-400/50",
    cardTint: "bg-pink-500/[0.035] dark:bg-pink-400/[0.05]",
    chipBg: "bg-pink-500/10 dark:bg-pink-400/12",
    chipText: "text-pink-600 dark:text-pink-300",
    ring: "ring-pink-500/50 dark:ring-pink-400/50",
  },
  dairy: {
    badgeBg: "bg-sky-500/12 dark:bg-sky-400/15",
    iconColor: "text-sky-600 dark:text-sky-300",
    accentBorder: "border-l-sky-500/50 dark:border-l-sky-400/50",
    cardTint: "bg-sky-500/[0.035] dark:bg-sky-400/[0.05]",
    chipBg: "bg-sky-500/10 dark:bg-sky-400/12",
    chipText: "text-sky-600 dark:text-sky-300",
    ring: "ring-sky-500/50 dark:ring-sky-400/50",
  },
  fat: {
    badgeBg: "bg-orange-500/12 dark:bg-orange-400/15",
    iconColor: "text-orange-600 dark:text-orange-300",
    accentBorder: "border-l-orange-500/50 dark:border-l-orange-400/50",
    cardTint: "bg-orange-500/[0.035] dark:bg-orange-400/[0.05]",
    chipBg: "bg-orange-500/10 dark:bg-orange-400/12",
    chipText: "text-orange-600 dark:text-orange-300",
    ring: "ring-orange-500/50 dark:ring-orange-400/50",
  },
  custom: {
    badgeBg: "bg-violet-500/12 dark:bg-violet-400/15",
    iconColor: "text-violet-600 dark:text-violet-300",
    accentBorder: "border-l-violet-500/50 dark:border-l-violet-400/50",
    cardTint: "bg-violet-500/[0.035] dark:bg-violet-400/[0.05]",
    chipBg: "bg-violet-500/10 dark:bg-violet-400/12",
    chipText: "text-violet-600 dark:text-violet-300",
    ring: "ring-violet-500/50 dark:ring-violet-400/50",
  },
  other: {
    badgeBg: "bg-slate-500/12 dark:bg-slate-400/14",
    iconColor: "text-slate-600 dark:text-slate-300",
    accentBorder: "border-l-slate-500/40 dark:border-l-slate-400/40",
    cardTint: "bg-slate-500/[0.03] dark:bg-slate-400/[0.04]",
    chipBg: "bg-slate-500/10 dark:bg-slate-400/12",
    chipText: "text-slate-600 dark:text-slate-300",
    ring: "ring-slate-500/40 dark:ring-slate-400/40",
  },
};

/** Always returns a usable style, defaulting to "other" for unknown/missing categories. */
export function getCategoryStyle(category?: FoodCategory | string | null): CategoryStyle {
  if (category && category in CATEGORY_STYLES) {
    return CATEGORY_STYLES[category as FoodCategory];
  }
  return CATEGORY_STYLES.other;
}
