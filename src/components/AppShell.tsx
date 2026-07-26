"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { QuickLogSheet } from "./QuickLogSheet";
import { StoreProvider } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

function Splash() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/App_logo.svg"
        alt="BodyBuddy"
        className="h-14 w-14 rounded-2xl shadow-glow-nova animate-pulse-glow"
      />
      <Loader2 className="w-5 h-5 text-nova-400 animate-spin" />
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [logOpen, setLogOpen] = useState(false);
  const isLogin = pathname === "/login";
  const hideChrome = pathname === "/onboarding" || isLogin;

  useEffect(() => {
    if (loading) return;
    if (!user && !isLogin) router.replace("/login");
    if (user && isLogin) router.replace("/");
  }, [loading, user, isLogin, router]);

  if (loading) return <Splash />;

  if (!user) {
    // Only the login page renders while signed out; everything else is a
    // brief redirect flash handled above.
    if (!isLogin) return <Splash />;
    return <>{children}</>;
  }

  if (isLogin) return <Splash />;

  return (
    <StoreProvider>
      <div className="mx-auto max-w-md min-h-dvh flex flex-col">
        <main className={hideChrome ? "flex-1" : "flex-1 pb-28"}>{children}</main>
        {!hideChrome && <BottomNav onLog={() => setLogOpen(true)} />}
        <QuickLogSheet open={logOpen} onClose={() => setLogOpen(false)} />
        {!configured && (
          <div className="fixed top-0 inset-x-0 z-50 bg-ember-600 text-white text-[11px] text-center py-1 px-2">
            Supabase not configured — data won&apos;t be saved. See supabase/schema.sql and .env.example.
          </div>
        )}
      </div>
    </StoreProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}
