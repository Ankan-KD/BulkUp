"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a number as tappable text. Tap (or click) it and it turns into a
 * real input so you can type an exact value instead of tapping +/- a bunch
 * of times. Commits on blur or Enter, cancels on Escape.
 *
 * Meant to sit right next to the existing +/- stepper buttons — this
 * doesn't replace them, it just gives a second way to change the value.
 */
export function EditableNumber({
  value,
  onChange,
  min = 0,
  max,
  decimals = 0,
  className,
  inputClassName,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** How many decimal places to round a typed value to. */
  decimals?: number;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!Number.isFinite(parsed)) return;
    let v = Math.round(parsed * 10 ** decimals) / 10 ** decimals;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(v);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={ariaLabel}
        className={cn(
          "no-spinner bg-transparent text-center outline-none border-b-2 border-nova-500 tabular-nums",
          inputClassName ?? className
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      aria-label={ariaLabel ? `${ariaLabel}, tap to type a value` : "Tap to type a value"}
      className={cn("tabular-nums cursor-text", className)}
    >
      {value}
    </button>
  );
}
