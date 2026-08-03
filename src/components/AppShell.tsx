"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { QuickLogSheet } from "./QuickLogSheet";
import { LogDateSwitcher } from "./LogDateSwitcher";
import { StoreProvider } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { AppIcon } from "./AppIcon";

function Splash() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3">
      <AppIcon className="h-14 w-14 rounded-2xl shadow-glow-nova animate-pulse-glow" />
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
  const isPublicMarketing = pathname === "/landing";
  const isPublic = isLogin || isPublicMarketing;
  const hideChrome = pathname === "/onboarding" || isPublic;

  useEffect(() => {
    if (loading) return;
    // Signed-out visitors land on the marketing page first, not straight
    // on the signup form — /login stays directly reachable too (e.g. a
    // returning user with the link bookmarked).
    if (!user && !isPublic) router.replace("/landing");
    if (user && isPublic) router.replace("/");
  }, [loading, user, isPublic, router]);

  if (loading) return <Splash />;

  if (!user) {
    // Only the marketing and login pages render while signed out;
    // everything else is a brief redirect flash handled above.
    if (!isPublic) return <Splash />;
    return <>{children}</>;
  }

  if (isPublic) return <Splash />;

  return (
    <StoreProvider>
      <div className="mx-auto max-w-md min-h-dvh flex flex-col">
        {!hideChrome && <LogDateSwitcher />}
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
