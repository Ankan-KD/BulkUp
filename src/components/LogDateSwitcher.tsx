"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDaysISO, MAX_BACKDATE_DAYS, relativeDayLabel, todayISO } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Lets the user redirect every logging action (diet, quick-log/recent
 * foods, combos, water, weight) to a past day — for the "forgot to log
 * before midnight" case — instead of always writing to today.
 *
 * Two pieces, always rendered together:
 *  - a small pill button that opens the day picker
 *  - a banner that appears ONLY while a past day is selected, so it's
 *    never silently active. Tapping the banner jumps straight back to Today.
 *
 * The picker only offers the last MAX_BACKDATE_DAYS days (see utils.ts) —
 * deliberately not a free date field, to keep this predictable.
 */
export function LogDateSwitcher() {
  const { activeLogDate, setActiveLogDate } = useStore();
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const isToday = activeLogDate === today;

  const options = useMemo(
    () => Array.from({ length: MAX_BACKDATE_DAYS + 1 }, (_, i) => addDaysISO(today, -i)),
    [today]
  );

  return (
    <>
      {isToday ? (
        <button
          onClick={() => setOpen(true)}
          className="mx-4 mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] active:scale-[0.97] transition-transform"
        >
          <CalendarClock className="w-3.5 h-3.5" />
          Logging for Today
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-ember-600 px-3.5 py-2 text-xs font-semibold text-white active:scale-[0.98] transition-transform"
        >
          <CalendarClock className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">
            Logging for {relativeDayLabel(activeLogDate)} — everything you log goes here
          </span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              setActiveLogDate(today);
            }}
            className="shrink-0 underline underline-offset-2"
          >
            Switch to Today
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-void-950/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-semibold flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-[var(--text-muted)]" />
                Log for which day?
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="ml-auto h-8 w-8 flex items-center justify-center rounded-full hover:bg-nova-700/8 dark:hover:bg-nova-100/8"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Everything you log — diet, quick-log, combos, water, weight — will be recorded against this day
              instead of today, until you switch back.
            </p>
            <div className="flex flex-col gap-1.5">
              {options.map((date) => {
                const selected = date === activeLogDate;
                return (
                  <button
                    key={date}
                    onClick={() => {
                      setActiveLogDate(date);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-left transition-colors",
                      selected
                        ? "bg-nova-600 text-white"
                        : "bg-[var(--bg)] text-[var(--text)] hover:bg-nova-500/10"
                    )}
                  >
                    <span>{relativeDayLabel(date)}</span>
                    <span className={cn("text-xs", selected ? "text-white/80" : "text-[var(--text-muted)]")}>
                      {date}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
