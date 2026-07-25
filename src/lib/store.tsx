"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  DailyFoodLog,
  DayRecord,
  FoodTemplate,
  UserSettings,
  WeightEntry,
} from "./types";
import { todayISO } from "./utils";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

const DEFAULT_SETTINGS: UserSettings = {
  name: "",
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
  category: string;
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
    category: (r.category as FoodTemplate["category"]) || "other",
    baseIngredient: r.base_ingredient ?? "",
  };
}

interface SettingsRow {
  name: string;
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
  return { date, logs: [], waterMl: 0 };
}

interface StoreShape {
  settings: UserSettings;
  foods: FoodTemplate[];
  today: DayRecord;
  history: DayRecord[];
  weights: WeightEntry[];
}

interface StoreContextValue extends StoreShape {
  updateSettings: (patch: Partial<UserSettings>) => void;
  addFood: (food: Omit<FoodTemplate, "id" | "sortOrder">) => void;
  createAndLogFood: (food: Omit<FoodTemplate, "id" | "sortOrder">, quantityConsumed: number) => Promise<string | null>;
  updateFood: (id: string, patch: Partial<FoodTemplate>) => void;
  archiveFood: (id: string) => void;
  logQuantity: (foodId: string, quantity: number) => void;
  addQuantity: (foodId: string, delta: number) => void;
  toggleBinary: (foodId: string) => void;
  addWaterMl: (delta: number) => void;
  addWeightEntry: (weightKg: number) => void;
  ready: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const HISTORY_WINDOW_DAYS = 120;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<StoreShape>({
    settings: DEFAULT_SETTINGS,
    foods: [],
    today: emptyDay(todayISO()),
    history: [],
    weights: [],
  });
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Initial load + realtime sync whenever the logged-in user changes ──
  useEffect(() => {
    if (!supabase || !user) {
      setState({
        settings: DEFAULT_SETTINGS,
        foods: [],
        today: emptyDay(todayISO()),
        history: [],
        weights: [],
      });
      setReady(!user ? true : false);
      return;
    }

    let cancelled = false;
    setReady(false);
    const uid = user.id;

    async function load() {
      const since = new Date();
      since.setDate(since.getDate() - HISTORY_WINDOW_DAYS);
      const sinceISO = since.toISOString().slice(0, 10);

      const [settingsRes, foodsRes, logsRes, waterRes, weightsRes] = await Promise.all([
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
      ]);

      if (cancelled) return;

      const settings = settingsRes.data ? settingsFromRow(settingsRes.data) : DEFAULT_SETTINGS;
      const foods = (foodsRes.data ?? []).map(foodFromRow);
      const weights: WeightEntry[] = (weightsRes.data ?? []).map((w) => ({
        date: w.date,
        weightKg: Number(w.weight_kg),
      }));

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
        d.logs.push({ foodId: log.food_id, loggedQuantity: Number(log.logged_quantity) });
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

      setState({ settings, foods, today: todayRecord, history, weights });
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
    const tempId = `temp-${Date.now()}`;
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
        category: food.category,
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

  async function createAndLogFood(
    food: Omit<FoodTemplate, "id" | "sortOrder">,
    quantityConsumed: number
  ): Promise<string | null> {
    if (!supabase || !user) return null;
    const sortOrder = stateRef.current.foods.length;
    const { data, error } = await supabase
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
        category: food.category,
        base_ingredient: food.baseIngredient,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("createAndLogFood failed", error?.message);
      return null;
    }

    const created = foodFromRow(data as FoodRow);
    setState((s) => ({ ...s, foods: [...s.foods, created] }));
    upsertTodayLog(created.id, quantityConsumed);
    return created.id;
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
    if (patch.category !== undefined) row.category = patch.category;
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

  function upsertTodayLog(foodId: string, quantity: number) {
    const date = todayISO();
    const clamped = Math.max(0, quantity);
    setState((s) => {
      const existing = s.today.logs.find((l) => l.foodId === foodId);
      const logs: DailyFoodLog[] = existing
        ? s.today.logs.map((l) => (l.foodId === foodId ? { ...l, loggedQuantity: clamped } : l))
        : [...s.today.logs, { foodId, loggedQuantity: clamped }];
      return { ...s, today: { ...s.today, logs } };
    });
    if (!supabase || !user) return;
    supabase
      .from("day_logs")
      .upsert(
        { user_id: user.id, date, food_id: foodId, logged_quantity: clamped },
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
    const existing = stateRef.current.today.logs.find((l) => l.foodId === foodId);
    const current = existing?.loggedQuantity ?? 0;
    upsertTodayLog(foodId, current + delta);
  }

  function toggleBinary(foodId: string) {
    const food = stateRef.current.foods.find((f) => f.id === foodId);
    if (!food) return;
    const existing = stateRef.current.today.logs.find((l) => l.foodId === foodId);
    const isDone = (existing?.loggedQuantity ?? 0) >= food.targetQuantity;
    upsertTodayLog(foodId, isDone ? 0 : food.targetQuantity);
  }

  function addWaterMl(delta: number) {
    const date = todayISO();
    const next = Math.max(0, stateRef.current.today.waterMl + delta);
    setState((s) => ({ ...s, today: { ...s.today, waterMl: next } }));
    if (!supabase || !user) return;
    supabase
      .from("daily_water")
      .upsert({ user_id: user.id, date, water_ml: next }, { onConflict: "user_id,date" })
      .then(({ error }) => {
        if (error) console.error("addWaterMl failed", error.message);
      });
  }

  function addWeightEntry(weightKg: number) {
    const date = todayISO();
    setState((s) => {
      const others = s.weights.filter((w) => w.date !== date);
      return {
        ...s,
        weights: [...others, { date, weightKg }].sort((a, b) => a.date.localeCompare(b.date)),
        today: { ...s.today, weightKg },
      };
    });
    if (!supabase || !user) return;
    supabase
      .from("weight_entries")
      .upsert({ user_id: user.id, date, weight_kg: weightKg }, { onConflict: "user_id,date" })
      .then(({ error }) => {
        if (error) console.error("addWeightEntry failed", error.message);
      });
  }

  const value: StoreContextValue = useMemo(
    () => ({
      ...state,
      updateSettings,
      addFood,
      createAndLogFood,
      updateFood,
      archiveFood,
      logQuantity,
      addQuantity,
      toggleBinary,
      addWaterMl,
      addWeightEntry,
      ready,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, ready]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
