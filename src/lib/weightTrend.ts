import { GoalMode, WeightEntry } from "./types";
import { round1 } from "./utils";

/**
 * Weight trend math (Phase 6). Kept separate from goalCopy.ts because this
 * is genuine numeric analysis (rolling averages, regression) rather than
 * plain copy — goalCopy.ts still owns the simple "since start" label.
 */

export interface RollingPoint {
  date: string;
  rawKg: number; // the actual logged entry that day
  avgKg: number; // trailing N-day average ending on this date
}

function dateToDayNumber(iso: string): number {
  return Math.floor(new Date(iso + "T00:00:00").getTime() / 86400000);
}

function addDaysISO(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * A trailing rolling average computed over the entries themselves (not
 * every calendar day), so sparse logging still produces a sensible curve
 * instead of gaps or false zeros.
 */
export function computeRollingAverage(weights: WeightEntry[], windowDays = 7): RollingPoint[] {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((entry) => {
    const cutoff = addDaysISO(entry.date, -(windowDays - 1));
    const windowEntries = sorted.filter((w) => w.date >= cutoff && w.date <= entry.date);
    const avg = windowEntries.reduce((s, w) => s + w.weightKg, 0) / windowEntries.length;
    return { date: entry.date, rawKg: entry.weightKg, avgKg: round1(avg) };
  });
}

/**
 * Weekly rate of change in kg/week, fit via simple linear regression over
 * the last `lookbackDays` of entries (falls back to whatever's available).
 * Regression smooths out single-day noise far better than a two-point
 * diff, which is what actually makes the interpretation below trustworthy.
 * Returns null when there isn't enough data to say anything meaningful.
 */
export function computeWeeklyRateKg(weights: WeightEntry[], lookbackDays = 28): number | null {
  if (weights.length < 2) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = addDaysISO(sorted[sorted.length - 1].date, -lookbackDays);
  const windowed = sorted.filter((w) => w.date >= cutoff);
  const points = windowed.length >= 2 ? windowed : sorted.slice(-2);
  if (points.length < 2) return null;

  const x0 = dateToDayNumber(points[0].date);
  const xs = points.map((p) => dateToDayNumber(p.date) - x0);
  const ys = points.map((p) => p.weightKg);
  const n = xs.length;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  if (den === 0) return 0; // every entry landed on the same day — nothing to fit

  const slopePerDay = num / den;
  return round1(slopePerDay * 7);
}

export interface ProgressInterpretation {
  headline: string;
  detail?: string; // optional secondary line, e.g. an ETA to goal weight
}

// Below this magnitude (kg/week), movement reads as noise rather than a
// real trend — call it stable instead of quoting a near-zero number.
const STABLE_THRESHOLD = 0.1;
// The sustainable range this app recommends elsewhere (see nutrition
// guardrails in goalCopy.ts) — used here to judge pace, not just direction.
const SENSIBLE_MIN = 0.2;
const SENSIBLE_MAX = 0.6;
const FAST_MAX = 0.9;

/**
 * Turns a weekly rate into the kind of plain-language read the user
 * actually wants: is this working, is it too slow/fast, and roughly when
 * would it get them to their goal at this pace.
 */
export function interpretProgress(
  goal: GoalMode,
  weeklyRateKg: number | null,
  currentWeightKg: number,
  goalWeightKg: number
): ProgressInterpretation {
  if (weeklyRateKg === null) {
    return { headline: "Log a few more weigh-ins to see your trend." };
  }

  const magnitude = Math.abs(weeklyRateKg);
  const direction: "up" | "down" | "flat" = magnitude < STABLE_THRESHOLD ? "flat" : weeklyRateKg > 0 ? "up" : "down";

  if (goal === "maintain") {
    if (direction === "flat") {
      return { headline: "Weight trend is stable — right where you want it." };
    }
    return {
      headline: `Trending slightly ${direction} — averaging about ${magnitude} kg/week. A small calorie adjustment can help if you'd like it steadier.`,
    };
  }

  const wantsUp = goal === "gain";
  const verb = wantsUp ? "Gaining" : "Losing";

  if (direction === "flat") {
    return {
      headline: `Weight trend is stable — you're not ${
        wantsUp ? "gaining" : "losing"
      } yet despite your ${wantsUp ? "surplus" : "deficit"} target. Consider adjusting your calorie goal.`,
    };
  }

  const movingRightDirection = (wantsUp && direction === "up") || (!wantsUp && direction === "down");

  if (!movingRightDirection) {
    return {
      headline: `Weight is trending ${direction} — the opposite of your ${
        wantsUp ? "gain" : "loss"
      } goal. Consider reviewing your calorie target.`,
    };
  }

  let pace: string;
  if (magnitude < SENSIBLE_MIN) {
    pace = "a bit slower than planned";
  } else if (magnitude <= SENSIBLE_MAX) {
    pace = "on pace with your goal";
  } else if (magnitude <= FAST_MAX) {
    pace = "slightly faster than planned";
  } else {
    pace = `much faster than planned — consider a smaller ${wantsUp ? "surplus" : "deficit"}`;
  }

  const headline = `${verb} approximately ${magnitude} kg/week — ${pace}.`;

  let detail: string | undefined;
  const remaining = Math.abs(goalWeightKg - currentWeightKg);
  if (remaining > 0.05 && magnitude > 0) {
    const weeks = Math.round(remaining / magnitude);
    if (weeks > 0 && weeks <= 104) {
      detail = `On pace to reach your goal in about ${weeks} week${weeks === 1 ? "" : "s"}.`;
    } else if (weeks === 0) {
      detail = "You're essentially at your goal weight.";
    }
  }

  return { headline, detail };
}
