"use client";

import { ReactNode } from "react";
import { BulkUp } from "./BulkUp";
import { ProgressStatus } from "@/lib/goalCopy";

export function GrowthRing({
  progress,
  status = "good",
  size = 220,
  children,
}: {
  progress: number; // 0..1
  status?: ProgressStatus;
  size?: number;
  children?: ReactNode;
}) {
  const p = Math.min(1, Math.max(0, progress));
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - p);
  const needsAttention = status === "warning" || status === "adjust";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="fill-none stroke-nova-100 dark:stroke-nova-900"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          stroke={needsAttention ? "url(#ringGradientWarning)" : "url(#ringGradient)"}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 500ms cubic-bezier(0.34,1.2,0.64,1), stroke 300ms ease",
            filter: needsAttention
              ? "drop-shadow(0 0 3px rgba(240,110,60,0.35))"
              : "drop-shadow(0 0 3px var(--ring-glow, rgba(59,130,246,0.35)))",
          }}
        />
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ring-grad-start, #3b82f6)" />
            <stop offset="50%" stopColor="var(--ring-grad-mid, #5f70ea)" />
            <stop offset="100%" stopColor="var(--ring-grad-end, #7c5cf0)" />
          </linearGradient>
          <linearGradient id="ringGradientWarning" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f0a53c" />
            <stop offset="100%" stopColor="#e0603c" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
        <BulkUp progress={p} className="w-14 h-14 mb-1" />
        {children}
      </div>
    </div>
  );
}
