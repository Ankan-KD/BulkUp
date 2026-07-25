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
import { FALLBACK_ICON_KEY } from "./iconKeys";

export { FOOD_ICON_OPTIONS, CATEGORY_ICON_KEYS, ALL_ICON_KEYS } from "./iconKeys";

const IconMap = LucideIcons as unknown as Record<string, ComponentType<LucideProps>>;

export function isKnownIcon(key: string | undefined | null): boolean {
  return !!key && !!IconMap[key];
}

/** Resolve an icon key to a renderable component, always falling back safely. */
export function resolveIcon(key: string | undefined | null): ComponentType<LucideProps> {
  if (key && IconMap[key]) return IconMap[key];
  return IconMap[FALLBACK_ICON_KEY];
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
