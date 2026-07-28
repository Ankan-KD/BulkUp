"use client";

import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/ui/button";
import { getCategoryStyle } from "@/lib/icons";
import {
  ArrowRight,
  Sparkles,
  Salad,
  FileText,
  Trophy,
  Egg,
  Milk,
  Wheat,
  Banana,
  Droplets,
  ChevronRight,
} from "lucide-react";

/**
 * Public marketing entry point. Reachable while signed out (see the
 * isPublicMarketing check in AppShell's Gate) — this is where an
 * unauthenticated visitor lands now, instead of being pushed straight to
 * /login. Purely presentational: no store/auth reads, so it renders
 * instantly, before Supabase/session state has resolved.
 *
 * Structure borrows the layout of a Figma comp the founder put together
 * (nav -> pill -> hero -> phone mockup -> feature grid -> closing CTA),
 * but everything is reskinned onto BodyBuddy's actual design system —
 * the real AppIcon, the nova/aurora/ember palette, glass-panel cards,
 * the real GrowthRing colours — rather than the Figma file's own
 * hard-coded green palette, so the marketing page and the product don't
 * look like two different apps. The phone mockup shows a stylised replay
 * of the real dashboard (calorie ring, macro rings, food checklist,
 * water) instead of invented screens, and drops the Figma file's fake
 * "10,000+ users" social proof, which this app doesn't actually have.
 *
 * Motion is intentionally minimal and CSS-only (no JS animation, no
 * canvas) so it stays smooth on low-end/low-RAM phones:
 *   - the starfield + nebula backdrop is the same fixed, blurred
 *     radial-gradient trick already used app-wide (see globals.css)
 *   - the hero/floating cards reuse the existing `animate-grow-in`
 *     entrance keyframe
 * No new keyframes, no new dependencies.
 */

const FEATURES = [
  {
    icon: Sparkles,
    color: "text-nova-400",
    chip: "bg-nova-500/10",
    title: "Adapts to your goal",
    body: "Gain, lose, or maintain — the targets, ring, and coaching all change with you.",
  },
  {
    icon: Salad,
    color: "text-aurora-400",
    chip: "bg-aurora-500/10",
    title: "Checklist, not a search bar",
    body: "Build your own list of everyday foods and just tap them off. No database diving.",
  },
  {
    icon: FileText,
    color: "text-ember-400",
    chip: "bg-ember-500/10",
    title: "Reports worth sharing",
    body: "Generate a clean PDF of your trends in one tap — ready for a coach or doctor.",
  },
  {
    icon: Trophy,
    color: "text-nova-300",
    chip: "bg-nova-500/10",
    title: "Milestones & streaks",
    body: "Quiet celebrations for first weeks, goal weight, and every honest streak.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col px-6 pt-6 pb-10">
        {/* ── Nav ──────────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <AppIcon className="h-8 w-8 rounded-xl" />
            <span className="font-display text-[17px] font-semibold tracking-tight">BodyBuddy</span>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Log in
          </Link>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="animate-grow-in">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-nova-500/10 px-3 py-1 text-xs font-medium text-nova-300 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-nova-400 animate-pulse" />
            Goal-based nutrition
          </span>

          <h1 className="font-display text-[2.3rem] leading-[1.12] font-semibold text-[var(--text)] tracking-tight">
            Fuel your goal.
            <br />
            Track what matters.
            <br />
            <span className="italic text-glow-nova text-nova-300">Actually stick with it.</span>
          </h1>

          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)] max-w-[26rem]">
            BodyBuddy reshapes itself around whichever goal you&apos;re chasing —
            bulking up, cutting down, or simply holding steady.
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            <Link href="/login?mode=signup">
              <Button size="lg" className="w-full">
                Get started free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="w-full">
                Log in
              </Button>
            </Link>
          </div>
        </section>

        {/* ── Phone mockup ─────────────────────────────────────────── */}
        <section className="pt-10 pb-6 flex justify-center relative">
          <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 rounded-full bg-nova-500/10 blur-[70px]" />
          </div>

          <div className="relative flex items-start justify-center pt-2">
            {/* Floating card — top right */}
            <div className="absolute -right-3 top-6 z-20 w-[92px] glass-panel rounded-2xl border border-[var(--border)] shadow-card overflow-hidden animate-grow-in">
              <div className="h-[46px] bg-rose-500/12 dark:bg-rose-400/15 flex items-center justify-center">
                <Egg className="w-5 h-5 text-rose-600 dark:text-rose-300" />
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[9px] font-semibold text-[var(--text)] leading-tight truncate">Eggs logged</p>
                <p className="text-[8px] text-nova-400 mt-0.5 font-medium">4 · 280 kcal</p>
              </div>
            </div>

            {/* Floating card — bottom left */}
            <div className="absolute -left-3 bottom-16 z-20 w-[80px] glass-panel rounded-2xl border border-[var(--border)] shadow-card overflow-hidden animate-grow-in">
              <div className="h-[40px] bg-pink-500/12 dark:bg-pink-400/15 flex items-center justify-center">
                <Banana className="w-4 h-4 text-pink-600 dark:text-pink-300" />
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[9px] font-semibold text-[var(--text)] leading-tight truncate">Banana</p>
                <p className="text-[8px] text-nova-400 mt-0.5 font-medium">105 kcal</p>
              </div>
            </div>

            {/* Phone frame */}
            <div
              className="relative z-10 overflow-hidden flex flex-col"
              style={{
                width: 216,
                borderRadius: 36,
                background: "var(--bg)",
                border: "3px solid var(--border)",
                boxShadow:
                  "0 40px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(124,92,240,0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div className="flex justify-center pt-2 pb-1" style={{ background: "var(--bg)" }}>
                <div className="w-16 h-[18px] rounded-b-2xl" style={{ background: "var(--bg)" }} />
              </div>

              <div className="flex-1 flex flex-col" style={{ minHeight: 382, background: "var(--bg)" }}>
                <div className="flex justify-between items-center px-3.5 pt-1 pb-1.5">
                  <span className="text-[8px] text-[var(--text-muted)] font-medium">9:41</span>
                  <span className="text-[7px] text-[var(--text-muted)]">● ● ● ▮▮</span>
                </div>

                <div className="px-3.5 pb-2">
                  <p className="text-[8px] text-[var(--text-muted)]">Monday, Jul 28</p>
                  <p className="text-[13px] font-display font-semibold text-[var(--text)] mt-0.5">Hi, Alex 👋</p>
                </div>

                {/* Calorie card */}
                <div className="mx-2.5 mb-2 glass-panel rounded-2xl p-2.5 border border-[var(--border)] shadow-soft">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[7px] text-[var(--text-muted)] uppercase tracking-wide font-medium">Calories</p>
                      <p className="text-[17px] font-display font-semibold text-[var(--text)] leading-tight">1,840</p>
                      <p className="text-[8px] text-[var(--text-muted)]">of 2,200 kcal</p>
                    </div>
                    <div className="relative w-[50px] h-[50px]">
                      <svg viewBox="0 0 50 50" className="w-full h-full -rotate-90">
                        <circle cx="25" cy="25" r="19" fill="none" stroke="var(--border)" strokeWidth="5" />
                        <circle
                          cx="25"
                          cy="25"
                          r="19"
                          fill="none"
                          stroke="url(#landingRingGradient)"
                          strokeWidth="5"
                          strokeDasharray={`${(1840 / 2200) * 2 * Math.PI * 19} ${2 * Math.PI * 19}`}
                          strokeLinecap="round"
                          style={{ filter: "drop-shadow(0 0 5px var(--ring-glow, rgba(124,92,240,0.5)))" }}
                        />
                        <defs>
                          <linearGradient id="landingRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--ring-grad-start, #7c5cf0)" />
                            <stop offset="100%" stopColor="var(--ring-grad-end, #2ecfdd)" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-display font-semibold text-nova-300">73%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-nova-500 to-aurora-400" style={{ width: "73%" }} />
                  </div>
                </div>

                {/* Macros */}
                <div className="mx-2.5 mb-2 glass-panel rounded-2xl p-2.5 border border-[var(--border)] shadow-soft">
                  <p className="text-[7px] text-[var(--text-muted)] uppercase tracking-wide font-medium mb-2">Macros</p>
                  <div className="flex justify-around">
                    <MacroRing percent={64} value="62g" label="Carbs" stroke="stroke-ember-400" text="text-ember-400" />
                    <MacroRing percent={52} value="48g" label="Protein" stroke="stroke-nova-400" text="text-nova-400" />
                    <MacroRing percent={38} value="28g" label="Fat" stroke="stroke-aurora-400" text="text-aurora-400" />
                  </div>
                </div>

                {/* Foods checklist */}
                <div className="mx-2.5 mb-2 glass-panel rounded-2xl p-2.5 border border-[var(--border)] shadow-soft">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[7px] text-[var(--text-muted)] uppercase tracking-wide font-medium">
                      Today&apos;s foods
                    </p>
                    <span className="text-[7px] text-nova-400 flex items-center gap-0.5 font-semibold">
                      Add <ChevronRight size={8} />
                    </span>
                  </div>
                  <MealRow icon={Egg} name="Eggs" sub="4 · done" category="protein" />
                  <MealRow icon={Wheat} name="Oats" sub="100g · done" category="grain" />
                  <MealRow icon={Milk} name="Milk" sub="350 / 500ml" category="dairy" last />
                </div>

                {/* Water */}
                <div className="mx-2.5 mb-3 glass-panel rounded-2xl p-2.5 border border-[var(--border)] shadow-soft">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1">
                      <Droplets size={9} className="text-aurora-400" />
                      <p className="text-[7px] text-[var(--text-muted)] uppercase tracking-wide font-medium">Water</p>
                    </div>
                    <span className="text-[8px] font-semibold text-aurora-400">1.8 / 2.5L</span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 h-2 rounded-full"
                        style={{ background: i < 5 ? "var(--ring-grad-end, #2ecfdd)" : "var(--border)" }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="py-2 flex items-center justify-center" style={{ background: "var(--bg)" }}>
                <div className="w-14 h-1 rounded-full bg-[var(--text-muted)] opacity-30" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────── */}
        <section className="pt-6 pb-2">
          <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-4">
            Why BodyBuddy
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, color, chip, title, body }) => (
              <div
                key={title}
                className="relative glass-panel rounded-2xl p-4 flex flex-col gap-3 border border-[var(--border)] shadow-soft overflow-hidden group hover:border-nova-500/30 transition-colors duration-300"
              >
                <div className={`w-9 h-9 rounded-xl ${chip} flex items-center justify-center relative z-10`}>
                  <Icon size={16} className={color} aria-hidden />
                </div>
                <div className="relative z-10">
                  <p className="font-display font-semibold text-[13px] text-[var(--text)]">{title}</p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────────── */}
        <section className="pt-8 flex flex-col gap-2.5">
          <Link href="/login?mode=signup">
            <Button size="lg" className="w-full">
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <p className="text-center text-[11px] text-[var(--text-muted)] mt-1">
            Free to start. Your data stays private to your account.
          </p>
        </section>
      </div>
    </div>
  );
}

function MacroRing({
  percent,
  value,
  label,
  stroke,
  text,
}: {
  percent: number;
  value: string;
  label: string;
  stroke: string;
  text: string;
}) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-11 h-11">
        <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
          <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            className={stroke}
            strokeWidth="4"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[8px] font-bold ${text}`}>{value}</span>
      </div>
      <span className="text-[8px] text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

function MealRow({
  icon: Icon,
  name,
  sub,
  category,
  last = false,
}: {
  icon: typeof Egg;
  name: string;
  sub: string;
  category: Parameters<typeof getCategoryStyle>[0];
  last?: boolean;
}) {
  const style = getCategoryStyle(category);
  return (
    <div className={`flex items-center gap-2 py-1.5 ${last ? "" : "border-b border-[var(--border)]"}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${style.badgeBg}`}>
        <Icon className={`w-3.5 h-3.5 ${style.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-[var(--text)] truncate">{name}</p>
        <p className="text-[8px] text-[var(--text-muted)]">{sub}</p>
      </div>
    </div>
  );
}
