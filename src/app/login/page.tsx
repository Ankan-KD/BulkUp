"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Mail, Lock, User as UserIcon, Loader2, Sparkles } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, configured } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const result =
      mode === "signup"
        ? await signUpWithEmail(email, password, name)
        : await signInWithEmail(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (mode === "signup") {
      setNotice("Account created. If email confirmation is required, check your inbox — otherwise you're in!");
    }
    router.replace("/");
  }

  async function google() {
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
  }

  return (
    <div className="min-h-dvh flex flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <AppIcon className="h-16 w-16 rounded-2xl shadow-glow-nova mb-4" />
          <h1 className="font-display text-2xl font-semibold text-glow-nova">BodyBuddy</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Your goals, tracked — one day at a time.</p>
        </div>

        {!configured && (
          <div className="mb-5 rounded-xl2 border border-ember-500/40 bg-ember-500/10 px-4 py-3 text-xs text-ember-300">
            Supabase isn&apos;t configured yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your environment, then run{" "}
            <code>supabase/schema.sql</code> in your project.
          </div>
        )}

        <div className="flex rounded-xl2 border border-[var(--border)] p-1 mb-6 glass-panel">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === "signin" ? "bg-nova-600 text-white shadow-glow-nova" : "text-[var(--text-muted)]"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              mode === "signup" ? "bg-nova-600 text-white shadow-glow-nova" : "text-[var(--text-muted)]"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <FieldInput icon={UserIcon} type="text" placeholder="Your name" value={name} onChange={setName} />
          )}
          <FieldInput icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} required />
          <FieldInput
            icon={Lock}
            type="password"
            placeholder="Password"
            value={password}
            onChange={setPassword}
            required
            minLength={6}
          />

          {error && <p className="text-xs text-ember-400">{error}</p>}
          {notice && <p className="text-xs text-aurora-400">{notice}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={loading || !configured}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "signup" ? "Create account" : "Log in"}
          </Button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-muted)]">or</span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={google}
          disabled={!configured}
        >
          <Sparkles className="w-4 h-4 text-aurora-400" />
          Continue with Google
        </Button>

        <p className="text-center text-[11px] text-[var(--text-muted)] mt-6">
          Your data is private to your account and synced securely across your devices.
        </p>
      </div>
    </div>
  );
}

function FieldInput({
  icon: Icon,
  value,
  onChange,
  ...props
}: {
  icon: typeof Mail;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pl-10 pr-4 py-3 text-sm outline-none focus:border-nova-500 focus:shadow-glow placeholder:text-[var(--text-muted)]"
        {...props}
      />
    </div>
  );
}
