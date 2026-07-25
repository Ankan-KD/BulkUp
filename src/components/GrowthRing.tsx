"use client";

import { ReactNode } from "react";
import { Sprout } from "./Sprout";

export function GrowthRing({
  progress,
  size = 220,
  children,
}: {
  progress: number; // 0..1
  size?: number;
  children?: ReactNode;
}) {
  const p = Math.min(1, Math.max(0, progress));
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - p);

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
          stroke="url(#ringGradient)"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 500ms cubic-bezier(0.34,1.2,0.64,1)",
            filter: "drop-shadow(0 0 6px rgba(124,92,240,0.55))",
          }}
        />
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c5cf0" />
            <stop offset="100%" stopColor="#2ecfdd" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
        <Sprout progress={p} className="w-14 h-14 mb-1" />
        {children}
      </div>
    </div>
  );
}
