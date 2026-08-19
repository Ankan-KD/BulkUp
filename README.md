<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=28&duration=2800&pause=800&color=FF7A00&center=true&vCenter=true&width=750&lines=BODYBUDDY+%E2%80%94+Nutrition+Companion;Track.+Eat.+Streak.+Achieve." alt="BodyBuddy Typing SVG"/>

<br>

<img src="https://img.shields.io/badge/Status-Live-ff7a00?style=for-the-badge&logoColor=white"/>
<img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white"/>
<img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
<img src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white"/>
<img src="https://img.shields.io/badge/Gemini-AI_Coach-7b2cff?style=for-the-badge&logo=google&logoColor=white"/>
<img src="https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white"/>

<br><br>

**BodyBuddy** is a mobile-first goal-based nutrition companion that adapts to whether you want to gain, lose, or maintain weight — tracking daily meals, weight progress, and nutrition streaks with a Gemini-powered AI coach available whenever you need a recommendation.

<br>

[→ Live Demo](https://bulk-up-three.vercel.app) &nbsp;&nbsp;|&nbsp;&nbsp; [→ Repository](https://github.com/Ankan-KD/BulkUp) &nbsp;&nbsp;|&nbsp;&nbsp; [→ Report an Issue](https://github.com/Ankan-KD/BulkUp/issues)

</div>

---

## ◈ Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Deployment](#-deployment)
- [Author](#-author)

---

## ◈ Overview

BodyBuddy solves a real problem: most nutrition apps don't care about your goal. They log food — but they don't adapt to whether you're bulking, cutting, or maintaining.

BodyBuddy puts your **goal at the center** of everything — your daily food checklist, your nutrition targets, your streak milestones, and your AI coach's responses are all calibrated to what you're actually trying to achieve.

```
USER SETS GOAL (gain / lose / maintain)
            ↓
DAILY FOOD CHECKLIST ADAPTS TO CALORIE TARGET
            ↓
WEIGHT & NUTRITION LOGGED → DASHBOARD UPDATES
            ↓
STREAKS & MILESTONES TRACKED
            ↓
AI COACH (Gemini) → "What can I eat right now?"
            ↓
HISTORY + PDF EXPORT FOR REVIEW
```

---

## ◈ Features

<table>
<tr>
<td width="50%">

**🎯 Goal-Aware Tracking**
- Set goal: Gain / Lose / Maintain weight
- Daily calorie & macro targets adapt to your goal
- Weight logging with trend visualization
- Daily food checklist — mark meals as done

</td>
<td width="50%">

**🧠 AI Nutrition Coach (Gemini)**
- Ask "What can I eat right now?" at any point
- Coach knows your goal, remaining calories, and logged meals
- Actionable, practical replies — not generic advice
- Context-aware real-time recommendations

</td>
</tr>
<tr>
<td width="50%">

**🔥 Streaks & Achievements**
- Daily streak tracking with streak protection logic
- Goal-aware milestone badges
- Logging history across all past days

</td>
<td width="50%">

**☁️ Auth & Cloud Sync**
- Email & Google OAuth via Supabase Auth
- All data synced to Supabase PostgreSQL with RLS
- PDF export of nutrition history (jsPDF + autotable)
- Mobile-first responsive design

</td>
</tr>
</table>

---

## ◈ Tech Stack

<div align="center">

<img src="https://skillicons.dev/icons?i=nextjs,ts,tailwind,supabase,react" />

</div>

<br>

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (strict) |
| **Styling** | Tailwind CSS + tailwind-merge + clsx |
| **Database** | Supabase (PostgreSQL + Row Level Security) |
| **Auth** | Supabase Auth — Email + Google OAuth |
| **AI** | Google Gemini API (goal-aware nutrition coach) |
| **Icons** | Lucide React |
| **PDF Export** | jsPDF + jsPDF-AutoTable |
| **Deployment** | Vercel |

---

## ◈ Project Structure

```
BulkUp/
│
├── src/
│   ├── app/                  # Next.js App Router pages & layouts
│   │   ├── dashboard/        # Main dashboard — nutrition summary
│   │   ├── food/             # Daily food checklist
│   │   ├── weight/           # Weight logging & trends
│   │   ├── history/          # Past day logs
│   │   ├── coach/            # Gemini AI coach interface
│   │   └── settings/         # User preferences & goal config
│   ├── components/           # Reusable UI components
│   └── lib/                  # Supabase client, helpers, types
│
├── public/                   # Static assets
├── scripts/                  # Utility / seed scripts
├── supabase/
│   └── schema.sql            # DB schema — run this to set up tables
│
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## ◈ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [Supabase](https://supabase.com/) project (free tier works)
- A [Google Gemini API key](https://aistudio.google.com/) (for the AI coach)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Ankan-KD/BulkUp.git

# 2. Navigate into the project
cd BulkUp

# 3. Install dependencies
npm install

# 4. Set up your environment variables
cp .env.example .env.local
# Fill in your Supabase URL, anon key, and Gemini API key

# 5. Set up the database (see Database Setup below)

# 6. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## ◈ Environment Variables

Create `.env.local` in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Gemini AI Coach
GEMINI_API_KEY=your_gemini_api_key
```

> ⚠️ Never commit `.env.local`. It's already in `.gitignore`.

---

## ◈ Database Setup

```bash
# 1. Create a Supabase project at https://supabase.com
# 2. Open the SQL editor in your Supabase dashboard
# 3. Run the schema file:
```

Copy the contents of `supabase/schema.sql` into the Supabase SQL editor and execute it. This creates all required tables with Row Level Security policies.

Then:
- Enable **Email Auth** in Supabase → Authentication → Providers
- Optionally enable **Google OAuth** (add Client ID + Secret from Google Cloud Console)
- Expose the tables via the Data API (Settings → API)

---

## ◈ Deployment

The project is Vercel-ready out of the box.

```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy
vercel --prod
```

Or connect the repo directly in the [Vercel dashboard](https://vercel.com/new).

**After deploying**, update in Supabase:
- Authentication → URL Configuration → **Site URL** → your Vercel domain
- Add your Vercel domain to **Redirect URLs**

---

## ◈ Scripts

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

---

## ◈ Author

<div align="center">

**Ankan Kumar Daw**
Full-Stack Developer · AI/ML Engineer · MCA @ Techno Main Salt Lake

<br>

<a href="https://github.com/Ankan-KD"><img src="https://img.shields.io/badge/GitHub-Ankan--KD-0d1117?style=for-the-badge&logo=github&logoColor=white"/></a>
<a href="https://www.linkedin.com/in/akd5544/"><img src="https://img.shields.io/badge/LinkedIn-Connect-7b2cff?style=for-the-badge&logo=linkedin&logoColor=white"/></a>
<a href="mailto:ankandaw.24@gmail.com"><img src="https://img.shields.io/badge/Email-ankandaw.24@gmail.com-ff7a00?style=for-the-badge&logo=gmail&logoColor=white"/></a>

<br><br>

<sub>Part of a broader portfolio of full-stack, AI, and cloud systems — <a href="https://github.com/Ankan-KD">explore more on GitHub</a>.</sub>

</div>

---

<div align="center">

<sub>Built with Next.js · TypeScript · Supabase · Gemini API · Tailwind CSS</sub>

<br>

<img src="https://komarev.com/ghpvc/?username=Ankan-KD&style=for-the-badge&color=ff7a00" alt="Profile views"/>

</div>
