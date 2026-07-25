# 🌱 BulkUp — Weight Gain Tracker

A simple, fast, mobile-first habit tracker for gaining weight — built around
completing foods, not counting calories.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs entirely on
local mock data (saved to your browser's localStorage) out of the box — no
setup required to try it.

## Wiring up the real backend (optional)

Copy `.env.example` to `.env.local` and fill in:

- **Supabase** — create a project, run the schema commented in
  `src/lib/supabase.ts`, and add your project URL + anon key. This enables
  real email/Google auth and per-user cloud storage instead of localStorage.
- **OpenAI** — add an API key to make Quick Log use real AI parsing
  (`gpt-4o-mini`) instead of the built-in local heuristic parser. Both work
  the same way from the UI — the AI version just understands more phrasing.

## What's inside

- **Dashboard** — the daily growth ring (calories), today's food checklist,
  and compact nutrition summary.
- **Foods** — recurring food templates that drive the checklist and AI log.
- **Quick Log** — type what you ate in plain language; it's parsed and
  checked off automatically, no confirmation screens.
- **Weight** — current weight, goal, gained, and a simple trend.
- **History** — daily completion records.
- **Settings** — goals, units, theme.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · lucide-react ·
Supabase · OpenAI — exactly the stack in the brief, no extra tooling.
