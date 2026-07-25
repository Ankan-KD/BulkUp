"use client";

import { useState } from "react";
import { Sheet } from "./ui/sheet";
import { Button } from "./ui/button";
import { useStore } from "@/lib/store";
import { parseFoodEntry } from "@/lib/parseFood";
import { ParsedFoodMatch } from "@/lib/types";
import { Sparkles, Check, Loader2 } from "lucide-react";

const EXAMPLES = [
  "Had 2 eggs and a protein shake",
  "Finished half my chicken",
  "Drank milk and ate rice",
];

export function QuickLogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { foods, addQuantity, toggleBinary } = useStore();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [chips, setChips] = useState<ParsedFoodMatch[] | null>(null);

  async function handleSubmit(value?: string) {
    const input = (value ?? text).trim();
    if (!input) return;
    setLoading(true);
    setChips(null);

    // Try the server-side AI route first (uses OpenAI if configured),
    // falling back instantly to the local heuristic parser otherwise.
    let matches: ParsedFoodMatch[] = [];
    try {
      const res = await fetch("/api/parse-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, foods }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.matches)) matches = data.matches;
      }
    } catch {
      // network/AI unavailable — fall back below
    }
    if (matches.length === 0) {
      matches = parseFoodEntry(input, foods);
    }

    // apply
    for (const m of matches) {
      const food = foods.find((f) => f.id === m.foodId);
      if (!food) continue;
      if (food.kind === "binary") {
        toggleBinary(food.id);
      } else {
        addQuantity(food.id, m.addedQuantity);
      }
    }

    setChips(matches);
    setLoading(false);
    setText("");
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setChips(null);
        onClose();
      }}
      title="What did you eat?"
    >
      <div className="space-y-4">
        <div className="relative">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Had 2 eggs and a protein shake"
            rows={2}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 pr-12 text-[15px] focus:border-nova-500 outline-none placeholder:text-[var(--text-muted)]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Sparkles className="absolute right-4 top-3.5 w-4 h-4 text-aurora-500" />
        </div>

        {!chips && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => handleSubmit(ex)}
                className="text-xs px-3 py-1.5 rounded-full bg-nova-700/6 hover:bg-nova-700/10 text-[var(--text-muted)] transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {chips && chips.length > 0 && (
          <div className="flex flex-wrap gap-2 animate-pop">
            {chips.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-nova-600 text-white"
              >
                <Check className="w-3.5 h-3.5" />
                {c.name} {c.note}
              </span>
            ))}
          </div>
        )}

        {chips && chips.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">
            Couldn&apos;t match that to a food yet — try naming one from your Foods list, or add it there first.
          </p>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={() => handleSubmit()}
          disabled={loading || !text.trim()}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log it"}
        </Button>
      </div>
    </Sheet>
  );
}
