"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Apple, Scale, History, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Today", icon: LayoutGrid },
  { href: "/foods", label: "Foods", icon: Apple },
  { href: "__log__", label: "Log", icon: Sparkles },
  { href: "/weight", label: "Weight", icon: Scale },
  { href: "/history", label: "History", icon: History },
];

export function BottomNav({ onLog }: { onLog: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="mx-auto max-w-md grid grid-cols-5 items-end px-2 pt-2 pb-2">
        {items.map((item) => {
          const Icon = item.icon;
          if (item.href === "__log__") {
            return (
              <button
                key="log"
                onClick={onLog}
                className="flex flex-col items-center -translate-y-4"
                aria-label="Quick log what you ate"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-nova-500 to-aurora-500 text-white shadow-glow-nova active:scale-95 transition-transform">
                  <Icon className="w-6 h-6" />
                </span>
                <span className="mt-1 text-[11px] font-medium text-nova-400">
                  Quick Log
                </span>
              </button>
            );
          }
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-1.5 rounded-xl"
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-colors",
                  active ? "text-aurora-400" : "text-[var(--text-muted)]"
                )}
              />
              <span
                className={cn(
                  "text-[11px] font-medium transition-colors",
                  active ? "text-aurora-400" : "text-[var(--text-muted)]"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
