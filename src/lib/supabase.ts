import { createClient } from "@supabase/supabase-js";

// Set these in your .env.local (see .env.example). The full schema to run
// in your Supabase project's SQL editor lives in supabase/schema.sql.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// A single browser client shared across the app. Session tokens are kept
// in the browser's own auth storage (managed entirely by supabase-js) so
// that sessions persist across reloads and sync automatically — this is
// separate from application data, which now lives entirely in Postgres.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
