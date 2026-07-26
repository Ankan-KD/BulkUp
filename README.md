# BodyBuddy — Goal-Based Nutrition Companion

BodyBuddy is a modern nutrition companion that helps users gain, lose, or maintain weight by tracking daily meals, weight progress, and nutrition — all adapted to the goal they choose.

## Features

- 🔐 Email & Google Authentication (Supabase Auth)
- 🍽️ Daily food checklist
- ⚖️ Weight tracking & goal management
- 📊 Dashboard with nutrition summary
- 📅 History of daily logs
- 🔥 Streaks & goal-aware achievement milestones
- 🧠 AI Nutrition Coach — goal-aware "what can I eat right now?" recommendations and practical, actionable logging replies (Gemini)
- ⚙️ User settings & preferences
- ☁️ Cloud sync with Supabase

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL + RLS)
- Lucide React

## Getting Started

Install dependencies:

```bash
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run the development server:

```bash
npm run dev
```

Open **http://localhost:3000**

## Database Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Enable the Data API and expose the application tables.
4. Configure Email and Google Authentication (optional).

## Deployment

The project is ready for deployment on **Vercel**. Add the required environment variables and update the Supabase Site URL and Redirect URLs after deployment.

## License

Educational and personal use.