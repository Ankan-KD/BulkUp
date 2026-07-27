"use client";

import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, FileText, Salad, Sparkles } from "lucide-react";
import Link from "next/link";

/**
 * Public marketing entry point. Reachable while signed out (see the
 * isPublicMarketing check in AppShell's Gate) — this is where an
 * unauthenticated visitor lands now, instead of being pushed straight to
 * /login. Purely presentational: no store/auth reads, so it renders
 * instantly, before Supabase/session state has resolved.
 *
 * Motion is intentionally minimal and CSS-only (no JS animation, no
 * canvas) so it stays smooth on low-end/low-RAM phones:
 *   - the starfield + nebula backdrop is the same fixed, blurred
 *     radial-gradient trick already used app-wide (see globals.css)
 *   - the logo glow reuses the existing `animate-pulse-glow` keyframe
 *   - the hero reuses the existing `animate-grow-in` entrance keyframe
 * No new keyframes, no new dependencies.
 */

const FEATURES = [
  {
    icon: Sparkles,
    color: "text-nova-400",
    title: "Adapts to your goal",
    body: "Gain, lose, or maintain — the targets, ring, and coaching all change with you.",
  },
  {
    icon: Salad,
    color: "text-aurora-400",
    title: "Checklist, not a search bar",
    body: "Build your own list of everyday foods and just tap them off. No database diving.",
  },
  {
    icon: FileText,
    color: "text-ember-400",
    title: "Reports worth sharing",
    body: "Generate a clean PDF of your trends in one tap — ready for a coach or doctor.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-grow-in">
          <div className="relative mb-6">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-nova-500/30 blur-2xl animate-pulse-glow"
            />
            <AppIcon className="h-20 w-20 rounded-3xl shadow-glow-nova" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-nova-500/10 px-3 py-1 text-xs font-medium text-nova-300 mb-5">
            <Sparkles className="w-3 h-3" />
            Goal-based nutrition
          </span>

          <h1 className="font-display text-[2.15rem] leading-[1.15] font-semibold text-[var(--text)]">
            BodyBuddy.</h1>
            <br />
            <h2><span className="italic text-glow-nova">One App , Any Goal.</span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)] max-w-[22rem]">
            BodyBuddy reshapes itself around whichever goal you&apos;re chasing —
            bulking up, cutting down, or simply holding steady.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link href="/login?mode=signup" className="sm:w-auto">
              <Button size="lg" className="w-full">
                Get started
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login" className="sm:w-auto">
              <Button variant="outline" size="lg" className="w-full">
                Log in
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Feature strip ────────────────────────────────────────── */}
        <div className="grid gap-3 mt-10 mb-6">
          {FEATURES.map(({ icon: Icon, color, title, body }) => (
            <Card key={title} className="flex items-start gap-3 p-4">
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color}`} aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5 leading-snug">{body}</p>
              </div>
            </Card>
          ))}
        </div>

        <p className="text-center text-[11px] text-[var(--text-muted)]">
          Free to start. Your data stays private to your account.
        </p>
      </div>
    </div>
  );
}
