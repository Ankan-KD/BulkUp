"use client";

/**
 * React-facing icon helpers. The underlying key lists live in iconKeys.ts
 * (plain data, safe to import from server code too) — this file just adds
 * the lucide-react lookup + rendering on top.
 *
 * We deliberately don't do `import { Drumstick } from "lucide-react"` for
 * every icon, because if a key doesn't exist in the installed lucide-react
 * version, a named import would fail to compile. Instead we pull the whole
 * icon set in as a lookup table and fall back to a generic icon at runtime
 * if a key is ever missing — so a bad/legacy value can never crash the app.
 */

import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { FALLBACK_ICON_KEY, CATEGORY_ICON_KEYS } from "./iconKeys";
import { getCategoryStyle } from "./categoryStyles";
import { cn } from "./utils";
import type { FoodCategory } from "./types";

export { FOOD_ICON_OPTIONS, CATEGORY_ICON_KEYS, ALL_ICON_KEYS } from "./iconKeys";
export { getCategoryStyle } from "./categoryStyles";

const IconMap = LucideIcons as unknown as Record<string, ComponentType<LucideProps>>;

export function isKnownIcon(key: string | undefined | null): boolean {
  return !!key && !!IconMap[key];
}

/** Resolve an icon key to a renderable component, always falling back safely. */
export function resolveIcon(key: string | undefined | null): ComponentType<LucideProps> {
  if (key && IconMap[key]) return IconMap[key];
  return IconMap[FALLBACK_ICON_KEY];
}

/**
 * Icon resolution priority used everywhere a food is displayed:
 *   1. the food's own icon key, if it's a real, known icon
 *   2. its category's icon key, if the category is known
 *   3. the generic fallback icon
 * This means a food created without a valid/specific icon (e.g. a legacy
 * row, or an AI response that omitted "emoji") still shows something
 * sensible instead of a broken/blank icon.
 */
export function resolveFoodIconKey(
  iconKey: string | undefined | null,
  category?: FoodCategory | string | null
): string {
  if (iconKey && IconMap[iconKey]) return iconKey;
  const categoryIcon = category ? CATEGORY_ICON_KEYS[category as FoodCategory] : undefined;
  if (categoryIcon && IconMap[categoryIcon]) return categoryIcon;
  return FALLBACK_ICON_KEY;
}

/** Renders a food/category icon by key. Use this anywhere an emoji used to be shown. */
export function AppIcon({
  name,
  className,
  ...props
}: { name: string | undefined | null } & LucideProps) {
  const Comp = resolveIcon(name);
  return <Comp className={className} {...props} />;
}

const BADGE_SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-xl",
  lg: "h-11 w-11 rounded-xl",
};

const GLYPH_SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "w-4 h-4",
  md: "w-[18px] h-[18px]",
  lg: "w-5 h-5",
};

/**
 * A colourful, "filled" premium icon badge for a food or category — the
 * building block for every food row and section header. Colour is driven
 * entirely by category (see categoryStyles.ts), and the icon key resolves
 * through the food -> category -> fallback priority above, so it always
 * renders something on-brand even for freshly AI-created foods.
 *
 * Uses lucide-react's stroke icons with a soft currentColor fill layered
 * underneath, giving a duotone/premium look without pulling in a second
 * icon package.
 */
export function FoodIcon({
  iconKey,
  category,
  size = "md",
  className,
}: {
  iconKey?: string | null;
  category?: FoodCategory | string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const style = getCategoryStyle(category);
  const Icon = IconMap[resolveFoodIconKey(iconKey, category)] ?? IconMap[FALLBACK_ICON_KEY];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        BADGE_SIZE[size],
        style.badgeBg,
        className
      )}
    >
      <Icon
        className={cn(GLYPH_SIZE[size], style.iconColor)}
        fill="currentColor"
        fillOpacity={0.22}
        strokeWidth={1.75}
      />
    </span>
  );
}
