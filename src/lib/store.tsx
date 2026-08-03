"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import {
  DailyFoodLog,
  DayRecord,
  DietContribution,
  FoodTemplate,
  MealCombo,
  MilestoneKey,
  MilestoneRecord,
  RecentFoodLogEntry,
  RecentFoodTemplate,
  UserSettings,
  WeightEntry,
} from "./types";
import { addDaysISO, clampToBackdateWindow, dayOfWeekFromISO, isFoodScheduledOn, todayISO } from "./utils";

const DEFAULT_SETTINGS: UserSettings = {
  name: "",
  goalMode: "gain",
  calorieGoal: 3500,
  proteinGoal: 180,
  goalWeightKg: 80,
  startWeightKg: 70,
  waterGoalMl: 2500,
  units: "metric",
  theme: "dark",
  onboarded: false,
};

// ── DB row <-> app-model mapping ────────────────────────────────────────

interface FoodRow {
  id: string;
  name: string;
  emoji: string;
  target_quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  aliases: string[];
  sort_order: number;
  archived: boolean;
  kind: string;
  active_days: number[];
  active_date: string | null;
  category: string;
  custom_category: string;
  base_ingredient: string;
}

function foodFromRow(r: FoodRow): FoodTemplate {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    targetQuantity: Number(r.target_quantity),
    unit: r.unit as FoodTemplate["unit"],
    calories: Number(r.calories),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fats: Number(r.fats),
    aliases: r.aliases ?? [],
    sortOrder: r.sort_order,
    archived: r.archived,
    kind: r.kind as FoodTemplate["kind"],
    activeDays: r.active_days && r.active_days.length > 0 ? r.active_days : [0, 1, 2, 3, 4, 5, 6],
    dateOnly: r.active_date ?? null,
    category: (r.category as FoodTemplate["category"]) || "other",
    customCategory: r.custom_category ?? "",
    baseIngredient: r.base_ingredient ?? "",
  };
}

interface SettingsRow {
  name: string;
  goal_mode: string;
  calorie_goal: number;
  protein_goal: number;
  goal_weight_kg: number;
  start_weight_kg: number;
  water_goal_ml: number;
  units: string;
  theme: string;
  onboarded: boolean;
}

function settingsFromRow(r: SettingsRow): UserSettings {
  return {
    name: r.name ?? "",
    goalMode: (r.goal_mode as UserSettings["goalMode"]) || "gain",
    calorieGoal: Number(r.calorie_goal),
    proteinGoal: Number(r.protein_goal),
    goalWeightKg: Number(r.goal_weight_kg),
    startWeightKg: Number(r.start_weight_kg),
    waterGoalMl: Number(r.water_goal_ml),
    units: (r.units as UserSettings["units"]) ?? "metric",
    theme: (r.theme as UserSettings["theme"]) ?? "dark",
    onboarded: !!r.onboarded,
  };
}

function settingsToRow(s: Partial<UserSettings>) {
  const row: Record<string, unknown> = {};
  if (s.name !== undefined) row.name = s.name;
  if (s.goalMode !== undefined) row.goal_mode = s.goalMode;
  if (s.calorieGoal !== undefined) row.calorie_goal = s.calorieGoal;
  if (s.proteinGoal !== undefined) row.protein_goal = s.proteinGoal;
  if (s.goalWeightKg !== undefined) row.goal_weight_kg = s.goalWeightKg;
  if (s.startWeightKg !== undefined) row.start_weight_kg = s.startWeightKg;
  if (s.waterGoalMl !== undefined) row.water_goal_ml = s.waterGoalMl;
  if (s.units !== undefined) row.units = s.units;
  if (s.theme !== undefined) row.theme = s.theme;
  if (s.onboarded !== undefined) row.onboarded = s.onboarded;
  return row;
}

function emptyDay(date: string): DayRecord {
  return { date, logs: [], recentLogs: [], waterMl: 0 };
}

interface RecentFoodRow {
  id: string;
  name: string;
  emoji: string;
  target_quantity: number;
  unit: string;
  kind: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  aliases: string[];
  category: string;
  custom_category: string;
  base_ingredient: string;
  created_at: string;
}

function recentFoodFromRow(r: RecentFoodRow): RecentFoodTemplate {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    targetQuantity: Number(r.target_quantity),
    unit: r.unit as RecentFoodTemplate["unit"],
    kind: r.kind as RecentFoodTemplate["kind"],
    calories: Number(r.calories),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fats: Number(r.fats),
    aliases: r.aliases ?? [],
    category: (r.category as RecentFoodTemplate["category"]) || "other",
    customCategory: r.custom_category ?? "",
    baseIngredient: r.base_ingredient ?? "",
    createdAt: (r.created_at || "").slice(0, 10),
  };
}

interface ComboRow {
  id: string;
  name: string;
  icon: string;
  items: { foodId?: string; recentFoodId?: string; quantity: number }[] | null;
  sort_order: number;
}

function comboFromRow(r: ComboRow): MealCombo {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon || "UtensilsCrossed",
    items: Array.isArray(r.items)
      ? r.items
          .filter((i) => i && (typeof i.foodId === "string" || typeof i.recentFoodId === "string"))
          .map((i) => ({
            foodId: typeof i.foodId === "string" ? i.foodId : undefined,
            recentFoodId: typeof i.recentFoodId === "string" ? i.recentFoodId : undefined,
            quantity: Number(i.quantity) || 0,
          }))
      : [],
    sortOrder: r.sort_order,
  };
}

// `Date.now()` alone collides when several optimistic inserts happen in the
// same millisecond (e.g. onboarding's bulk "add chosen foods" loop), which
// produced duplicate React keys and, once resolved, duplicate real ids too.
// Add a random suffix so every temp id is unique regardless of timing.
function makeTempId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `temp-${Date.now()}-${rand}`;
}

interface MilestoneRow {
  key: string;
  achieved_at: string;
}

function milestoneFromRow(r: MilestoneRow): MilestoneRecord {
  return { key: r.key as MilestoneKey, achievedAt: r.achieved_at };
}

interface StoreShape {
  settings: UserSettings;
  foods: FoodTemplate[];
  recentFoods: RecentFoodTemplate[];
  today: DayRecord;
  history: DayRecord[];
  weights: WeightEntry[];
  combos: MealCombo[];
  milestones: MilestoneRecord[];
}

// Input for logRecentFood — either reference an existing Recent Foods
// catalog entry (recentFoodId) or supply a brand new one (template) to be
// created on the fly. dietContributions lets AI Case 3 (composite dish
// whose ingredients match existing Diet items) credit those Diet items in
// the same action as logging the dish itself.
interface LogRecentFoodInput {
  recentFoodId?: string;
  template?: Omit<RecentFoodTemplate, "id" | "createdAt">;
  quantity: number;
  dietContributions?: DietContribution[];
}

interface StoreContextValue extends StoreShape {
  // ── Backdated logging ────────────────────────────────────────────────
  // The calendar date every logging action (diet, quick-log/recent foods,
  // combos, water, weight) currently writes to. Defaults to real "today"
  // and always resets back to it on app open/login — it is intentionally
  // never persisted, so you can't silently stay in a past day for days.
  activeLogDate: string;
  // Clamped into [today - MAX_BACKDATE_DAYS, today] (see utils.ts) so a
  // stale UI value can never write outside the supported window.
  setActiveLogDate: (date: string) => void;
  // The DayRecord for activeLogDate — "today" when it really is today,
  // otherwise whatever's already logged for that past day (or a blank day
  // if nothing has been logged for it yet). Every part of the UI that
  // displays "what's logged" (checklist state, progress ring, water,
  // Today's Consumption) should read from THIS, not `today`, so switching
  // the date is a true time-travel: you see and edit that day's actual
  // state, not today's. `today` itself stays the real calendar day —
  // needed as-is by streaks/weekly-summary/milestones, which are about
  // real calendar continuity and shouldn't shift with the picker.
  viewDay: DayRecord;
  updateSettings: (patch: Partial<UserSettings>) => void;
  addFood: (food: Omit<FoodTemplate, "id" | "sortOrder">) => void;
  updateFood: (id: string, patch: Partial<FoodTemplate>) => void;
  archiveFood: (id: string) => void;
  deleteFood: (id: string) => void;
  logQuantity: (foodId: string, quantity: number) => void;
  addQuantity: (foodId: string, delta: number) => void;
  toggleBinary: (foodId: string) => void;
  addWaterMl: (delta: number) => void;
  addWeightEntry: (weightKg: number) => void;
  addCombo: (combo: Omit<MealCombo, "id" | "sortOrder">) => void;
  updateCombo: (id: string, patch: Partial<Omit<MealCombo, "id" | "sortOrder">>) => void;
  duplicateCombo: (id: string) => void;
  deleteCombo: (id: string) => void;
  logCombo: (id: string) => { loggedNames: string[]; skippedNames: string[] };
  recordMilestone: (key: MilestoneKey) => void;
  // ── Recent Foods ──────────────────────────────────────────────────
  logRecentFood: (input: LogRecentFoodInput) => Promise<string | null>;
  moveRecentFoodToDiet: (
    recentFoodId: string,
    schedule: { activeDays: number[]; dateOnly?: string | null }
  ) => void;
  deleteRecentFood: (id: string) => void;
  ready: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const HISTORY_WINDOW_DAYS = 120;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<StoreShape>({
    settings: DEFAULT_SETTINGS,
    foods: [],
    recentFoods: [],
    today: emptyDay(todayISO()),
    history: [],
    weights: [],
    combos: [],
    milestones: [],
  });
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Separate from `state` on purpose: `state` gets replaced wholesale by
  // `load()`, which reruns on every realtime change (a log write, a combo
  // edit, anything) — if activeLogDate lived inside `state` it would snap
  // back to "today" the instant the first backdated write round-tripped
  // through Supabase. Keeping it independent means it only resets when
  // this effect itself reruns (mount / user change / explicit reset),
  // never as a side effect of ordinary data syncing.
  const [activeLogDate, setActiveLogDateState] = useState<string>(todayISO());
  const activeLogDateRef = useRef(activeLogDate);
  activeLogDateRef.current = activeLogDate;

  function setActiveLogDate(date: string) {
    setActiveLogDateState(clampToBackdateWindow(date));
  }

  // Reads whichever DayRecord a given date currently resolves to — `today`
  // for the real calendar day, otherwise the matching (or a blank) entry
  // in `history`. This is the ONE place that decides where a log lives;
  // every logging function below goes through this (or its setState
  // counterpart, updateDay) instead of touching `state.today`/`state.history`
  // directly, so there's a single seam to get right rather than one per
  // function.
  function getDayRecord(date: string): DayRecord {
    const s = stateRef.current;
    if (date === todayISO()) return s.today;
    return s.history.find((d) => d.date === date) ?? emptyDay(date);
  }

  // Immutable update of whichever DayRecord `date` resolves to, applied
  // inside setState so it composes safely with concurrent updates.
  function updateDay(date: string, updater: (d: DayRecord) => DayRecord) {
    setState((s) => {
      if (date === todayISO()) {
        return { ...s, today: updater(s.today) };
      }
      const idx = s.history.findIndex((d) => d.date === date);
      if (idx === -1) {
        const history = [...s.history, updater(emptyDay(date))].sort((a, b) => a.date.localeCompare(b.date));
        return { ...s, history };
      }
      const history = s.history.map((d, i) => (i === idx ? updater(d) : d));
      return { ...s, history };
    });
  }

  // ── Initial load + realtime sync whenever the logged-in user changes ──
  useEffect(() => {
    // New login/session: always start on real "today", regardless of
    // whatever was selected before (e.g. a previous user, or a stale tab).
    setActiveLogDateState(todayISO());

    if (!supabase || !user) {
      setState({
        settings: DEFAULT_SETTINGS,
        foods: [],
        recentFoods: [],
        today: emptyDay(todayISO()),
        history: [],
        weights: [],
        combos: [],
        milestones: [],
      });
      setReady(!user ? true : false);
      return;
    }

    let cancelled = false;
    setReady(false);
    const uid = user.id;

    async function load() {
      const sinceISO = addDaysISO(todayISO(), -HISTORY_WINDOW_DAYS);

      const [
        settingsRes,
        foodsRes,
        logsRes,
        waterRes,
        weightsRes,
        combosRes,
        milestonesRes,
        recentFoodsRes,
        recentLogsRes,
      ] = await Promise.all([
        supabase!.from("user_settings").select("*").eq("user_id", uid).maybeSingle(),
        supabase!.from("foods").select("*").eq("user_id", uid).order("sort_order", { ascending: true }),
        supabase!
          .from("day_logs")
          .select("*")
          .eq("user_id", uid)
          .gte("date", sinceISO),
        supabase!
          .from("daily_water")
          .select("*")
          .eq("user_id", uid)
          .gte("date", sinceISO),
        supabase!.from("weight_entries").select("*").eq("user_id", uid).order("date", { ascending: true }),
        supabase!.from("meal_combos").select("*").eq("user_id", uid).order("sort_order", { ascending: true }),
        supabase!.from("milestones").select("*").eq("user_id", uid),
        supabase!.from("recent_foods").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase!
          .from("recent_food_logs")
          .select("*")
          .eq("user_id", uid)
          .gte("date", sinceISO),
      ]);

      if (cancelled) return;

      const settings = settingsRes.data ? settingsFromRow(settingsRes.data) : DEFAULT_SETTINGS;
      const foods = (foodsRes.data ?? []).map(foodFromRow);
      const recentFoods = (recentFoodsRes.data ?? []).map(recentFoodFromRow);
      const weights: WeightEntry[] = (weightsRes.data ?? []).map((w) => ({
        date: w.date,
        weightKg: Number(w.weight_kg),
      }));
      const combos = (combosRes.data ?? []).map(comboFromRow);
      const milestones = (milestonesRes.data ?? []).map(milestoneFromRow);

      const byDate = new Map<string, DayRecord>();
      function dayFor(date: string): DayRecord {
        let d = byDate.get(date);
        if (!d) {
          d = emptyDay(date);
          byDate.set(date, d);
        }
        return d;
      }
      for (const log of logsRes.data ?? []) {
        const d = dayFor(log.date);
        d.logs.push({
          foodId: log.food_id,
          loggedQuantity: Number(log.logged_quantity),
          contributedQuantity: Number(log.contributed_quantity ?? 0),
        });
      }
      for (const log of recentLogsRes.data ?? []) {
        const d = dayFor(log.date);
        d.recentLogs.push({
          recentFoodId: log.recent_food_id,
          loggedQuantity: Number(log.logged_quantity),
          mapped: !!log.mapped,
        });
      }
      for (const w of waterRes.data ?? []) {
        dayFor(w.date).waterMl = Number(w.water_ml);
      }
      for (const w of weights) {
        dayFor(w.date).weightKg = w.weightKg;
      }

      const today = todayISO();
      const todayRecord = byDate.get(today) ?? emptyDay(today);
      byDate.delete(today);
      const history = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

      setState({ settings, foods, recentFoods, today: todayRecord, history, weights, combos, milestones });
      setReady(true);
    }

    load();

    // Realtime: keep this device (and any others signed into the same
    // account) in sync automatically without a manual refresh.
    const channel = supabase
      .channel(`user-data-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "foods", filter: `user_id=eq.${uid}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "day_logs", filter: `user_id=eq.${uid}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_water", filter: `user_id=eq.${uid}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "weight_entries", filter: `user_id=eq.${uid}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_settings", filter: `user_id=eq.${uid}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_combos", filter: `user_id=eq.${uid}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones", filter: `user_id=eq.${uid}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "recent_foods", filter: `user_id=eq.${uid}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "recent_food_logs", filter: `user_id=eq.${uid}` }, () => load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase!.removeChannel(channel);
    };
  }, [user]);

  // Apply theme class to <html>
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const applyTheme = () => {
      const wantDark =
        state.settings.theme === "dark" ||
        (state.settings.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", wantDark);
      root.classList.toggle("princess", state.settings.theme === "princess");
    };
    applyTheme();
  }, [state.settings.theme, ready]);

  function updateSettings(patch: Partial<UserSettings>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    if (!supabase || !user) return;
    supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...settingsToRow(patch) }, { onConflict: "user_id" })
      .then(({ error }) => {
        if (error) console.error("updateSettings failed", error.message);
      });
  }

  function addFood(food: Omit<FoodTemplate, "id" | "sortOrder">) {
    if (!supabase || !user) return;
    const sortOrder = stateRef.current.foods.length;
    const tempId = makeTempId();
    const optimistic: FoodTemplate = { ...food, id: tempId, sortOrder };
    setState((s) => ({ ...s, foods: [...s.foods, optimistic] }));

    supabase
      .from("foods")
      .insert({
        user_id: user.id,
        name: food.name,
        emoji: food.emoji,
        target_quantity: food.targetQuantity,
        unit: food.unit,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
        aliases: food.aliases,
        sort_order: sortOrder,
        archived: food.archived,
        kind: food.kind,
        active_days: food.activeDays,
        active_date: food.dateOnly ?? null,
        category: food.category,
        custom_category: food.customCategory,
        base_ingredient: food.baseIngredient,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("addFood failed", error.message);
          setState((s) => ({ ...s, foods: s.foods.filter((f) => f.id !== tempId) }));
          return;
        }
        if (data) {
          setState((s) => ({
            ...s,
            foods: s.foods.map((f) => (f.id === tempId ? foodFromRow(data as FoodRow) : f)),
          }));
        }
      });
  }

  function updateFood(id: string, patch: Partial<FoodTemplate>) {
    setState((s) => ({
      ...s,
      foods: s.foods.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
    if (!supabase || !user) return;
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.emoji !== undefined) row.emoji = patch.emoji;
    if (patch.targetQuantity !== undefined) row.target_quantity = patch.targetQuantity;
    if (patch.unit !== undefined) row.unit = patch.unit;
    if (patch.calories !== undefined) row.calories = patch.calories;
    if (patch.protein !== undefined) row.protein = patch.protein;
    if (patch.carbs !== undefined) row.carbs = patch.carbs;
    if (patch.fats !== undefined) row.fats = patch.fats;
    if (patch.aliases !== undefined) row.aliases = patch.aliases;
    if (patch.archived !== undefined) row.archived = patch.archived;
    if (patch.kind !== undefined) row.kind = patch.kind;
    if (patch.activeDays !== undefined) row.active_days = patch.activeDays;
    if (patch.dateOnly !== undefined) row.active_date = patch.dateOnly;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.customCategory !== undefined) row.custom_category = patch.customCategory;
    if (patch.baseIngredient !== undefined) row.base_ingredient = patch.baseIngredient;
    supabase
      .from("foods")
      .update(row)
      .eq("id", id)
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) console.error("updateFood failed", error.message);
      });
  }

  function archiveFood(id: string) {
    updateFood(id, { archived: true });
  }

  function deleteFood(id: string) {
    setState((s) => ({
      ...s,
      foods: s.foods.filter((f) => f.id !== id),
      today: { ...s.today, logs: s.today.logs.filter((l) => l.foodId !== id) },
      history: s.history.map((d) => ({ ...d, logs: d.logs.filter((l) => l.foodId !== id) })),
    }));
    if (!supabase || !user) return;
    supabase
      .from("day_logs")
      .delete()
      .eq("user_id", user.id)
      .eq("food_id", id)
      .then(({ error }) => {
        if (error) console.error("deleteFood (day_logs) failed", error.message);
      });
    supabase
      .from("foods")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) console.error("deleteFood failed", error.message);
      });
  }

  // contributedQuantity, when passed, is the new *absolute* contributed
  // total to persist (not a delta) — callers resolve that themselves from
  // stateRef so we don't need to peek inside the setState updater. Omitting
  // it (the normal direct-log path) preserves whatever contributed amount
  // was already on the row.
  function upsertTodayLog(foodId: string, quantity: number, contributedQuantity?: number) {
    const date = activeLogDateRef.current;
    const clamped = Math.max(0, quantity);
    const existingBefore = getDayRecord(date).logs.find((l) => l.foodId === foodId);
    const resolvedContributed =
      contributedQuantity !== undefined ? Math.max(0, contributedQuantity) : existingBefore?.contributedQuantity ?? 0;
    updateDay(date, (d) => {
      const existing = d.logs.find((l) => l.foodId === foodId);
      const logs: DailyFoodLog[] = existing
        ? d.logs.map((l) =>
            l.foodId === foodId ? { ...l, loggedQuantity: clamped, contributedQuantity: resolvedContributed } : l
          )
        : [...d.logs, { foodId, loggedQuantity: clamped, contributedQuantity: resolvedContributed }];
      return { ...d, logs };
    });
    if (!supabase || !user) return;
    supabase
      .from("day_logs")
      .upsert(
        { user_id: user.id, date, food_id: foodId, logged_quantity: clamped, contributed_quantity: resolvedContributed },
        { onConflict: "user_id,date,food_id" }
      )
      .then(({ error }) => {
        if (error) console.error("logQuantity failed", error.message);
      });
  }

  function logQuantity(foodId: string, quantity: number) {
    upsertTodayLog(foodId, quantity);
  }

  function addQuantity(foodId: string, delta: number) {
    const existing = getDayRecord(activeLogDateRef.current).logs.find((l) => l.foodId === foodId);
    const current = existing?.loggedQuantity ?? 0;
    upsertTodayLog(foodId, current + delta);
  }

  // Same as addQuantity, but marks the added amount as credited via a
  // Recent Food's ingredients (e.g. biryani crediting Rice) rather than a
  // direct tap on the Diet checklist. Diet progress math is identical
  // either way — this only feeds the Dashboard's Today's Consumption view,
  // which uses it to avoid double-showing ingredients that were only eaten
  // as part of a composite dish (see logRecentFood's dietContributions).
  function creditContribution(foodId: string, delta: number) {
    // Guard against a foodId that isn't actually one of the user's Diet
    // items (e.g. the AI echoing back a mismatched/stale id). Without this,
    // upsertTodayLog would happily write a log row keyed to an id the Diet
    // checklist never reads, and the credit would silently disappear even
    // though the chat reply said it succeeded.
    const food = stateRef.current.foods.find((f) => f.id === foodId);
    if (!food) {
      console.warn(`creditContribution: ignoring unknown foodId "${foodId}" — no matching Diet item.`);
      return;
    }
    const existing = getDayRecord(activeLogDateRef.current).logs.find((l) => l.foodId === foodId);
    const currentLogged = existing?.loggedQuantity ?? 0;
    const currentContributed = existing?.contributedQuantity ?? 0;
    upsertTodayLog(foodId, currentLogged + delta, currentContributed + delta);
  }

  function toggleBinary(foodId: string) {
    const food = stateRef.current.foods.find((f) => f.id === foodId);
    if (!food) return;
    const existing = getDayRecord(activeLogDateRef.current).logs.find((l) => l.foodId === foodId);
    const isDone = (existing?.loggedQuantity ?? 0) >= food.targetQuantity;
    upsertTodayLog(foodId, isDone ? 0 : food.targetQuantity);
  }

  function addWaterMl(delta: number) {
    const date = activeLogDateRef.current;
    const next = Math.max(0, getDayRecord(date).waterMl + delta);
    updateDay(date, (d) => ({ ...d, waterMl: next }));
    if (!supabase || !user) return;
    supabase
      .from("daily_water")
      .upsert({ user_id: user.id, date, water_ml: next }, { onConflict: "user_id,date" })
      .then(({ error }) => {
        if (error) console.error("addWaterMl failed", error.message);
      });
  }

  function addWeightEntry(weightKg: number) {
    const date = activeLogDateRef.current;
    setState((s) => {
      const others = s.weights.filter((w) => w.date !== date);
      const weights = [...others, { date, weightKg }].sort((a, b) => a.date.localeCompare(b.date));
      if (date === todayISO()) {
        return { ...s, weights, today: { ...s.today, weightKg } };
      }
      const idx = s.history.findIndex((d) => d.date === date);
      const history =
        idx === -1
          ? [...s.history, { ...emptyDay(date), weightKg }].sort((a, b) => a.date.localeCompare(b.date))
          : s.history.map((d, i) => (i === idx ? { ...d, weightKg } : d));
      return { ...s, weights, history };
    });
    if (!supabase || !user) return;
    supabase
      .from("weight_entries")
      .upsert({ user_id: user.id, date, weight_kg: weightKg }, { onConflict: "user_id,date" })
      .then(({ error }) => {
        if (error) console.error("addWeightEntry failed", error.message);
      });
  }

  // ── Meal Combos ─────────────────────────────────────────────────────

  function addCombo(combo: Omit<MealCombo, "id" | "sortOrder">) {
    if (!supabase || !user) return;
    const sortOrder = stateRef.current.combos.length;
    const tempId = makeTempId();
    const optimistic: MealCombo = { ...combo, id: tempId, sortOrder };
    setState((s) => ({ ...s, combos: [...s.combos, optimistic] }));

    supabase
      .from("meal_combos")
      .insert({
        user_id: user.id,
        name: combo.name,
        icon: combo.icon,
        items: combo.items,
        sort_order: sortOrder,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("addCombo failed", error.message);
          setState((s) => ({ ...s, combos: s.combos.filter((c) => c.id !== tempId) }));
          return;
        }
        if (data) {
          setState((s) => ({
            ...s,
            combos: s.combos.map((c) => (c.id === tempId ? comboFromRow(data as ComboRow) : c)),
          }));
        }
      });
  }

  function updateCombo(id: string, patch: Partial<Omit<MealCombo, "id" | "sortOrder">>) {
    setState((s) => ({
      ...s,
      combos: s.combos.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    if (!supabase || !user) return;
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.icon !== undefined) row.icon = patch.icon;
    if (patch.items !== undefined) row.items = patch.items;
    supabase
      .from("meal_combos")
      .update(row)
      .eq("id", id)
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) console.error("updateCombo failed", error.message);
      });
  }

  function duplicateCombo(id: string) {
    const source = stateRef.current.combos.find((c) => c.id === id);
    if (!source) return;
    addCombo({
      name: `${source.name} copy`,
      icon: source.icon,
      items: source.items.map((i) => ({ ...i })),
    });
  }

  function deleteCombo(id: string) {
    setState((s) => ({ ...s, combos: s.combos.filter((c) => c.id !== id) }));
    if (!supabase || !user) return;
    supabase
      .from("meal_combos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) console.error("deleteCombo failed", error.message);
      });
  }

  function logCombo(id: string) {
    const combo = stateRef.current.combos.find((c) => c.id === id);
    if (!combo) return { loggedNames: [], skippedNames: [] };
    // Scheduled-on-this-day check follows the date you're actually logging
    // for (activeLogDate), not necessarily the real calendar day — e.g. a
    // combo backdated to a Monday should honor that Monday's schedule.
    const targetDate = activeLogDateRef.current;
    const loggedNames: string[] = [];
    const skippedNames: string[] = [];
    for (const item of combo.items) {
      if (item.recentFoodId) {
        // Recent Foods items always log — they have no schedule to miss.
        const recentFood = stateRef.current.recentFoods.find((f) => f.id === item.recentFoodId);
        if (!recentFood) continue; // deleted since the combo was saved — skip silently
        logRecentFood({ recentFoodId: item.recentFoodId, quantity: item.quantity });
        loggedNames.push(recentFood.name);
        continue;
      }
      const food = stateRef.current.foods.find((f) => f.id === item.foodId);
      if (!food) continue; // food was deleted since the combo was saved — skip it silently
      if (!isFoodScheduledOn(food, targetDate)) {
        // Not scheduled for today — skip rather than adding calories that
        // won't show up anywhere in "Today's Foods" (see known issue).
        skippedNames.push(food.name);
        continue;
      }
      addQuantity(item.foodId!, item.quantity);
      loggedNames.push(food.name);
    }
    return { loggedNames, skippedNames };
  }

  // ── Recent Foods ─────────────────────────────────────────────────────
  // Foods eaten that are NOT part of the Diet (Case 2/3 of the AI logging
  // spec, and manual "log something one-off" entries). These never touch
  // the `foods` (Diet) table or Today's Checklist — they get their own
  // catalog (recent_foods) + per-day history (recent_food_logs).

  async function logRecentFood(input: LogRecentFoodInput): Promise<string | null> {
    if (!supabase || !user) {
      console.error(
        `[logRecentFood] Aborted — ${!supabase ? "no Supabase client configured" : "no signed-in user"}. Nothing was saved for "${input.template?.name ?? input.recentFoodId ?? "unknown"}".`
      );
      return null;
    }
    const date = activeLogDateRef.current;

    let recentFoodId = input.recentFoodId ?? null;

    if (!recentFoodId) {
      if (!input.template) return null;
      const t = input.template;
      const { data, error } = await supabase
        .from("recent_foods")
        .insert({
          user_id: user.id,
          name: t.name,
          emoji: t.emoji,
          target_quantity: t.targetQuantity,
          unit: t.unit,
          kind: t.kind,
          calories: t.calories,
          protein: t.protein,
          carbs: t.carbs,
          fats: t.fats,
          aliases: t.aliases,
          category: t.category,
          custom_category: t.customCategory,
          base_ingredient: t.baseIngredient,
        })
        .select()
        .single();
      if (error || !data) {
        console.error("logRecentFood (create catalog entry) failed", error?.message);
        return null;
      }
      const created = recentFoodFromRow(data as RecentFoodRow);
      setState((s) => ({ ...s, recentFoods: [created, ...s.recentFoods] }));
      recentFoodId = created.id;
    }

    const clamped = Math.max(0, input.quantity);
    const hasContribution = !!(input.dietContributions && input.dietContributions.some((c) => c.foodId && c.quantity));
    updateDay(date, (d) => {
      const existing = d.recentLogs.find((l) => l.recentFoodId === recentFoodId);
      const recentLogs: RecentFoodLogEntry[] = existing
        ? d.recentLogs.map((l) =>
            l.recentFoodId === recentFoodId
              ? { ...l, loggedQuantity: l.loggedQuantity + clamped, mapped: l.mapped || hasContribution }
              : l
          )
        : [...d.recentLogs, { recentFoodId: recentFoodId!, loggedQuantity: clamped, mapped: hasContribution }];
      return { ...d, recentLogs };
    });

    const currentEntry = getDayRecord(date).recentLogs.find((l) => l.recentFoodId === recentFoodId);
    const nextQuantity = (currentEntry?.loggedQuantity ?? 0) + clamped;
    const nextMapped = (currentEntry?.mapped ?? false) || hasContribution;
    supabase
      .from("recent_food_logs")
      .upsert(
        { user_id: user.id, date, recent_food_id: recentFoodId, logged_quantity: nextQuantity, mapped: nextMapped },
        { onConflict: "user_id,date,recent_food_id" }
      )
      .then(({ error }) => {
        if (error) console.error("logRecentFood (log entry) failed", error.message);
      });

    // Case 3: credit any matching Diet items this dish's ingredients cover.
    // Uses creditContribution (not addQuantity) so the Dashboard's Today's
    // Consumption view can tell this was ingredient-credit, not a direct
    // log, and avoid showing e.g. "Rice" separately from "Chicken Biryani".
    if (input.dietContributions) {
      for (const c of input.dietContributions) {
        if (c.foodId && c.quantity) creditContribution(c.foodId, c.quantity);
      }
    }

    return recentFoodId;
  }

  // Promotes a Recent Food into the Diet — this is the ONLY way a Recent
  // Food becomes a recurring Diet item; the AI is never allowed to do this.
  function moveRecentFoodToDiet(recentFoodId: string, schedule: { activeDays: number[]; dateOnly?: string | null }) {
    const recentFood = stateRef.current.recentFoods.find((f) => f.id === recentFoodId);
    if (!recentFood) return;
    addFood({
      name: recentFood.name,
      emoji: recentFood.emoji,
      targetQuantity: recentFood.targetQuantity,
      unit: recentFood.unit,
      calories: recentFood.calories,
      protein: recentFood.protein,
      carbs: recentFood.carbs,
      fats: recentFood.fats,
      aliases: recentFood.aliases,
      archived: false,
      kind: recentFood.kind,
      activeDays: schedule.activeDays,
      dateOnly: schedule.dateOnly ?? null,
      category: recentFood.category,
      customCategory: recentFood.customCategory,
      baseIngredient: recentFood.baseIngredient,
    });
  }

  function deleteRecentFood(id: string) {
    setState((s) => ({
      ...s,
      recentFoods: s.recentFoods.filter((f) => f.id !== id),
      today: { ...s.today, recentLogs: s.today.recentLogs.filter((l) => l.recentFoodId !== id) },
      history: s.history.map((d) => ({ ...d, recentLogs: d.recentLogs.filter((l) => l.recentFoodId !== id) })),
    }));
    if (!supabase || !user) return;
    supabase
      .from("recent_foods")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .then(({ error }) => {
        if (error) console.error("deleteRecentFood failed", error.message);
      });
  }

  // ── Milestones (Phase 3) ────────────────────────────────────────────
  // Once a milestone is recorded it's permanent — this just marks that a
  // celebration has been shown, so we never re-celebrate the same one.

  function recordMilestone(key: MilestoneKey) {
    if (stateRef.current.milestones.some((m) => m.key === key)) return;
    const achievedAt = todayISO();
    setState((s) => ({ ...s, milestones: [...s.milestones, { key, achievedAt }] }));
    if (!supabase || !user) return;
    supabase
      .from("milestones")
      .upsert(
        { user_id: user.id, key, achieved_at: achievedAt },
        { onConflict: "user_id,key", ignoreDuplicates: true }
      )
      .then(({ error }) => {
        if (error) console.error("recordMilestone failed", error.message);
      });
  }

  const value: StoreContextValue = useMemo(
    () => ({
      ...state,
      activeLogDate,
      setActiveLogDate,
      viewDay: activeLogDate === todayISO() ? state.today : state.history.find((d) => d.date === activeLogDate) ?? emptyDay(activeLogDate),
      updateSettings,
      addFood,
      updateFood,
      archiveFood,
      deleteFood,
      logQuantity,
      addQuantity,
      toggleBinary,
      addWaterMl,
      addWeightEntry,
      addCombo,
      updateCombo,
      duplicateCombo,
      deleteCombo,
      logCombo,
      recordMilestone,
      logRecentFood,
      moveRecentFoodToDiet,
      deleteRecentFood,
      ready,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, ready, activeLogDate]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
