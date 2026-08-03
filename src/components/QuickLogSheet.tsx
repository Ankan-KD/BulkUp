"use client";

import { coachQuickPrompts, coachSubheading } from "@/lib/goalCopy";
import { AppIcon, FoodIcon, getCategoryStyle, resolveFoodIconKey } from "@/lib/icons";
import { computeCombinedTotals } from "@/lib/nutrition";
import { useStore } from "@/lib/store";
import { DietContribution, FoodCategory, GoalMode, RecentFoodTemplate } from "@/lib/types";
import {
  CheckCircle2,
  ChevronRight,
  Compass,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "./ui/sheet";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  logged?: { name: string; emoji: string; category?: string }[];
}

interface ChatAction {
  type: "log_diet" | "log_recent";
  // log_diet
  foodId?: string;
  quantityConsumed?: number;
  // log_recent
  recentFoodId?: string;
  name?: string;
  emoji?: string;
  unit?: string;
  kind?: string;
  targetQuantity?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  aliases?: string[];
  category?: string;
  customCategory?: string;
  baseIngredient?: string;
  quantityConsumedRecent?: number;
  dietContributions?: DietContribution[];
}

const GREETING: ChatMessage = {
  role: "assistant",
  text: "Tell me what you ate — one thing or ten, in your own words. I'll figure out the rest.",
};

const EXAMPLES = ["I had chicken biriyani", "3 eggs and a glass of milk", "Finished half my chicken"];

// ── AI Nutrition Coach (Phase 4) ────────────────────────────────────────
// Separate, read-mostly conversation: the coach only recommends food, it
// never logs on its own — the user taps a suggestion to log it, keeping
// the existing "describe what I ate" logging workflow completely untouched.

interface CoachSuggestion {
  foodId?: string;
  name: string;
  emoji?: string;
  category?: string;
  quantityConsumed?: number;
  reason: string;
}

interface CoachMessage {
  role: "user" | "assistant";
  text: string;
  suggestions?: CoachSuggestion[];
}

const COACH_GREETING: CoachMessage = {
  role: "assistant",
  text: "Ask me anything — what to eat right now, whether you're on track, or a swap idea.",
};

// Minimal ambient typing for the Web Speech API, which isn't in default TS libs.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

export function QuickLogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { foods, recentFoods, addQuantity, logQuantity, logRecentFood, combos, logCombo, settings, viewDay } =
    useStore();
  const [tab, setTab] = useState<"describe" | "combos" | "coach">("describe");
  const [comboFeedback, setComboFeedback] = useState<{ comboId: string; skipped: string[] } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  // Today's remaining calories/protein, shared by both the logging chat
  // (so its replies can be coach-flavored) and the dedicated Coach tab.
  // Combined Diet + Recent Foods, since both count toward what was eaten.
  // Uses viewDay (not necessarily real today) so this reflects whichever
  // day is currently selected for logging — see LogDateSwitcher.
  const totalsSoFar = useMemo(
    () => computeCombinedTotals(foods, recentFoods, viewDay),
    [foods, recentFoods, viewDay]
  );
  const coachContext = useMemo(
    () => ({
      goalMode: settings.goalMode as GoalMode,
      calorieGoal: settings.calorieGoal,
      proteinGoal: settings.proteinGoal,
      caloriesSoFar: totalsSoFar.calories,
      proteinSoFar: totalsSoFar.protein,
    }),
    [settings.goalMode, settings.calorieGoal, settings.proteinGoal, totalsSoFar]
  );

  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([COACH_GREETING]);
  const [coachText, setCoachText] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [loggedSuggestions, setLoggedSuggestions] = useState<Set<string>>(new Set());
  const coachScrollRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const foodsRef = useRef(foods);
  const recentFoodsRef = useRef(recentFoods);
  const baseTextRef = useRef("");        // text that existed before this mic session started
  const finalTranscriptRef = useRef(""); // finalized speech accumulated across all recognition restarts
  const sessionFinalRef = useRef("");    // finalized speech within the CURRENT recognition() run, rebuilt (not appended) on every onresult
  const manualStopRef = useRef(false);   // true only when the user explicitly presses mic-off (or an auto-stop below acts like one)
  const listeningRef = useRef(false);    // mirrors `listening` state but readable inside stable effect/listener closures
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  foodsRef.current = foods;
  recentFoodsRef.current = recentFoods;

  const SILENCE_STOP_MS = 2500; // stop the mic after this long with no speech activity

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  // Arms/re-arms the silence watchdog. Called on mic-start and on every
  // onresult (interim or final) — i.e. any sign the user is actually speaking.
  function armSilenceTimer() {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (!recognitionRef.current) return;
      manualStopRef.current = true; // treat like a manual stop so onend won't auto-restart
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }, SILENCE_STOP_MS);
  }

  // Used when the tab/page goes away (tab switch, app backgrounded, screen locked).
  function stopForInterruption() {
    if (!listeningRef.current || !recognitionRef.current) return;
    clearSilenceTimer();
    manualStopRef.current = true;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
    if (SR) {
      const rec: SpeechRecognitionLike = new SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
  
      rec.onresult = (e: any) => {
        // Any result event — interim or final — means the user is actively
        // speaking, so keep the silence watchdog from firing.
        armSilenceTimer();

        // Rebuild (never append) from index 0 every time. Desktop Chrome reports
        // only new results via e.resultIndex, but Android Chrome frequently
        // re-sends already-finalized results too (with resultIndex stuck at 0),
        // so appending on every event double/triple/quadruple-counts old text.
        // Recomputing the full session's final text fresh each event is
        // idempotent on both platforms.
        let sessionFinal = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const result = e.results[i];
          const chunk = result[0]?.transcript ?? "";
          if (result.isFinal) {
            sessionFinal = [sessionFinal, chunk.trim()].filter(Boolean).join(" ");
          } else {
            // Only keep the LAST interim entry, never sum them. Desktop Chrome
            // has a single interim entry that gets replaced in place, so this
            // changes nothing there. Android Chrome instead often emits a new
            // interim entry per word where each one already contains the full
            // growing phrase so far ("so" → "so today" → "so today I" → ...);
            // summing every entry (interim += chunk) re-multiplies that
            // cumulative text on every word, which is the repeating pattern.
            // The latest entry alone already reflects everything said so far.
            interim = chunk;
          }
        }
        sessionFinalRef.current = sessionFinal;
        const combinedFinal = [finalTranscriptRef.current, sessionFinalRef.current].filter(Boolean).join(" ");
        const committed = [baseTextRef.current, combinedFinal].filter(Boolean).join(" ");
        setText(interim ? [committed, interim].filter(Boolean).join(" ") : committed);
      };
  
      rec.onerror = (e: any) => {
        // Only truly fatal errors should stop listening; transient ones
        // ("no-speech", "aborted") are handled by the onend restart below.
        if (e?.error === "not-allowed" || e?.error === "audio-capture" || e?.error === "service-not-allowed") {
          manualStopRef.current = true;
          clearSilenceTimer();
          listeningRef.current = false;
          setListening(false);
        }
      };
  
      rec.onend = () => {
        if (manualStopRef.current) {
          clearSilenceTimer();
          listeningRef.current = false;
          setListening(false);
          return;
        }
        // Chrome periodically ends sessions on its own even mid-speech —
        // fold what was finalized this session into the persistent transcript
        // (the next session's e.results starts over from empty), then restart
        // since the user hasn't pressed mic-off.
        finalTranscriptRef.current = [finalTranscriptRef.current, sessionFinalRef.current]
          .filter(Boolean)
          .join(" ");
        sessionFinalRef.current = "";
        try {
          rec.start();
        } catch {
          // Can throw if start() is called too quickly after end(); ignore.
        }
      };
  
      recognitionRef.current = rec;
    }
  }, []);

  // Auto-stop the mic if the user switches tabs, backgrounds the app, or
  // locks the screen — but only if we're actually listening.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) stopForInterruption();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", stopForInterruption);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", stopForInterruption);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    coachScrollRef.current?.scrollTo({ top: coachScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [coachMessages, coachLoading]);

  function toggleMic() {
    if (!recognitionRef.current) return;
    if (listening) {
      manualStopRef.current = true;
      clearSilenceTimer();
      listeningRef.current = false;
      recognitionRef.current.stop();
      setListening(false);
    } else {
      manualStopRef.current = false;
      baseTextRef.current = text; // keep whatever was already typed/dictated
      finalTranscriptRef.current = "";
      sessionFinalRef.current = "";
      recognitionRef.current.start();
      listeningRef.current = true;
      setListening(true);
      armSilenceTimer(); // in case the user turns the mic on and says nothing at all
    }
  }

  // Returns null when the action failed to actually persist (e.g. Supabase
  // insert error, not signed in, "recent_foods"/"recent_food_logs" tables
  // missing) — previously the return value of logRecentFood was discarded
  // entirely, so the chat always reported success even when nothing was
  // saved. Callers MUST check for null instead of assuming success.
  async function applyAction(action: ChatAction): Promise<{ name: string; emoji: string; category?: string } | null> {
    // Case 1 — already a Diet item: just update today's progress.
    if (action.type === "log_diet" && action.foodId) {
      const food = foodsRef.current.find((f) => f.id === action.foodId);
      if (food) {
        if (food.kind === "binary") {
          logQuantity(food.id, food.targetQuantity);
        } else {
          addQuantity(food.id, action.quantityConsumed ?? food.targetQuantity);
        }
        return { name: food.name, emoji: food.emoji, category: food.category };
      }
    }

    // Case 2/3 — log into Recent Foods (reusing an existing catalog entry
    // when possible), optionally crediting matching Diet items along the
    // way. Icon resolution follows a strict priority: the model's own icon
    // key if it's a real known icon, else the category's icon, else a
    // generic one — so a new Recent Food always gets a sensible icon.
    const category = (action.category as FoodCategory) ?? "other";
    const existing = action.recentFoodId
      ? recentFoodsRef.current.find((f) => f.id === action.recentFoodId)
      : undefined;

    const quantity = action.quantityConsumedRecent ?? action.quantityConsumed ?? existing?.targetQuantity ?? 1;

    // No existing catalog entry to reuse AND no real name to create one
    // with — this is a malformed action (should already be caught
    // server-side in route.ts's validateChatResult, but never silently
    // fall back to a placeholder "Food" entry here either).
    if (!existing && !(action.name && action.name.trim())) {
      console.error(`[QuickLogSheet] Dropping log_recent action with no name and no matching recentFoodId.`, action);
      return null;
    }

    // Defense in depth against the "0 kcal ghost entry" bug: this should
    // already be caught server-side (validateChatResult drops new
    // log_recent actions with no usable calories before they're ever sent
    // here), but never silently create a new catalog entry with 0/missing
    // calories on this side either — a real food is never actually 0 kcal.
    if (!existing && !(typeof action.calories === "number" && action.calories > 0)) {
      console.error(
        `[QuickLogSheet] Dropping new log_recent action for "${action.name}" — missing/zero calories, refusing to create a 0-kcal entry.`,
        action
      );
      return null;
    }

    if (existing) {
      const result = await logRecentFood({
        recentFoodId: existing.id,
        quantity,
        dietContributions: action.dietContributions,
      });
      if (!result) {
        console.error(`[QuickLogSheet] logRecentFood failed for existing entry "${existing.name}" (${existing.id})`);
        return null;
      }
      return { name: existing.name, emoji: existing.emoji, category: existing.category };
    }

    const template: Omit<RecentFoodTemplate, "id" | "createdAt"> = {
      name: action.name!.trim(),
      emoji: resolveFoodIconKey(action.emoji, category),
      targetQuantity: action.targetQuantity ?? 1,
      unit: (action.unit as RecentFoodTemplate["unit"]) ?? "serving",
      kind: (action.kind as RecentFoodTemplate["kind"]) ?? "binary",
      calories: action.calories ?? 0,
      protein: action.protein ?? 0,
      carbs: action.carbs ?? 0,
      fats: action.fats ?? 0,
      aliases: action.aliases ?? [],
      category,
      customCategory: action.customCategory ?? "",
      baseIngredient: action.baseIngredient ?? (action.name ?? "food").toLowerCase(),
    };
    const result = await logRecentFood({
      template,
      quantity,
      dietContributions: action.dietContributions,
    });
    if (!result) {
      console.error(`[QuickLogSheet] logRecentFood failed while creating new entry "${template.name}"`);
      return null;
    }
    return { name: template.name, emoji: template.emoji, category: template.category };
  }

  async function send(value?: string) {
    const input = (value ?? text).trim();
    if (!input || loading) return;
    const history = [...messages, { role: "user" as const, text: input }];
    setMessages(history);
    setText("");
    setLoading(true);

    try {
      const res = await fetch("/api/food-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((m) => m !== GREETING)
            .map((m) => ({ role: m.role, text: m.text })),
          foods: foodsRef.current,
          recentFoods: recentFoodsRef.current,
          coach: coachContext,
        }),
      });
      const data = await res.json();
      const actions: ChatAction[] = Array.isArray(data.actions) ? data.actions : [];

      let logged: { name: string; emoji: string; category?: string }[] = [];
      let failedCount = 0;
      if (data.done && actions.length > 0) {
        const results = await Promise.all(actions.map(applyAction));
        logged = results.filter((r): r is { name: string; emoji: string; category?: string } => r !== null);
        failedCount = results.length - logged.length;
      }

      // If Gemini reported success but one or more actions actually failed
      // to save (Supabase error, not signed in, etc.), don't let its
      // confident reply text stand uncorrected — the person needs to know
      // nothing (or only some of what it says) was actually recorded.
      let replyText = data.reply || "Got it.";
      if (failedCount > 0) {
        replyText =
          logged.length > 0
            ? `${replyText}\n\n⚠️ Heads up — ${failedCount} of ${actions.length} item${actions.length > 1 ? "s" : ""} above didn't actually save (a server/database error). Check your connection and try logging ${failedCount > 1 ? "those again" : "it again"}.`
            : `I couldn't actually save that — something went wrong talking to the database (you may need to sign in again, or there's a server issue). Nothing was logged, please try again.`;
      }

      setMessages((m) => [
        ...m,
        { role: "assistant", text: replyText, logged: logged.length ? logged : undefined },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Hmm, I couldn't reach the server just now — mind trying again?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetConversation() {
    setMessages([GREETING]);
    setText("");
  }

  async function sendCoach(value?: string) {
    const input = (value ?? coachText).trim();
    if (!input || coachLoading) return;
    const history = [...coachMessages, { role: "user" as const, text: input }];
    setCoachMessages(history);
    setCoachText("");
    setCoachLoading(true);

    try {
      const res = await fetch("/api/nutrition-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((m) => m !== COACH_GREETING)
            .map((m) => ({ role: m.role, text: m.text })),
          foods: foodsRef.current,
          coach: coachContext,
        }),
      });
      const data = await res.json();
      const suggestions: CoachSuggestion[] = Array.isArray(data.suggestions) ? data.suggestions : [];
      setCoachMessages((m) => [
        ...m,
        { role: "assistant", text: data.reply || "Here's what I'd suggest.", suggestions },
      ]);
    } catch {
      setCoachMessages((m) => [
        ...m,
        { role: "assistant", text: "Hmm, I couldn't reach the server just now — mind trying again?" },
      ]);
    } finally {
      setCoachLoading(false);
    }
  }

  function resetCoachConversation() {
    setCoachMessages([COACH_GREETING]);
    setCoachText("");
    setLoggedSuggestions(new Set());
  }

  // Logs a suggestion the coach recommended. Only suggestions tied to a
  // real food in the library (foodId) are tappable — general ideas outside
  // the library are informational only, since they carry no nutrition data
  // to log accurately.
  function applySuggestion(key: string, suggestion: CoachSuggestion) {
    if (!suggestion.foodId || loggedSuggestions.has(key)) return;
    const food = foodsRef.current.find((f) => f.id === suggestion.foodId);
    if (!food) return;
    if (food.kind === "binary" || typeof suggestion.quantityConsumed !== "number") {
      logQuantity(food.id, food.targetQuantity);
    } else {
      addQuantity(food.id, suggestion.quantityConsumed);
    }
    setLoggedSuggestions((prev) => new Set(prev).add(key));
  }

  function handleLogCombo(id: string) {
    const result = logCombo(id);
    if (result.skippedNames.length > 0) {
      // Not scheduled for today — explain what happened instead of closing
      // and leaving the person to wonder why their totals didn't fully move.
      setComboFeedback({ comboId: id, skipped: result.skippedNames });
      setTimeout(() => {
        setComboFeedback(null);
        onClose();
      }, 2000);
    } else {
      onClose();
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose();
      }}
      title="Log"
    >
      <div className="flex flex-col h-[65vh] max-h-[560px]">
        {/* Describe / Combos / Coach toggle — Describe & Combos log food (unchanged Phase 1-3 workflow); Coach only recommends, tap a suggestion to log it */}
        <div className="flex gap-1 p-1 mb-3 rounded-xl bg-nova-700/8 shrink-0">
          <button
            onClick={() => setTab("describe")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-colors ${
              tab === "describe" ? "bg-[var(--bg-elevated)] shadow-soft" : "text-[var(--text-muted)]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Describe
          </button>
          <button
            onClick={() => setTab("combos")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-colors ${
              tab === "combos" ? "bg-[var(--bg-elevated)] shadow-soft" : "text-[var(--text-muted)]"
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Combos
          </button>
          <button
            onClick={() => setTab("coach")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-colors ${
              tab === "coach" ? "bg-[var(--bg-elevated)] shadow-soft" : "text-[var(--text-muted)]"
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> Coach
          </button>
        </div>

        {tab === "combos" ? (
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-3">
            {comboFeedback && (
              <div className="rounded-lg bg-ember-500/10 border border-ember-500/30 px-3 py-2 text-[12px] text-ember-600">
                {comboFeedback.skipped.join(", ")} {comboFeedback.skipped.length === 1 ? "isn't" : "aren't"} scheduled
                for today, so {comboFeedback.skipped.length === 1 ? "it wasn't" : "they weren't"} logged.
              </div>
            )}
            {combos.length > 0 ? (
              combos.map((combo) => (
                <button
                  key={combo.id}
                  onClick={() => handleLogCombo(combo.id)}
                  disabled={combo.items.length === 0}
                  className="w-full flex items-center gap-3 rounded-xl2 border border-[var(--border)] glass-panel px-3.5 py-3 shadow-soft active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  <FoodIcon iconKey={combo.icon} size="sm" />
                  <span className="text-sm font-medium flex-1 text-left">{combo.name}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {combo.items.length} item{combo.items.length === 1 ? "" : "s"}
                  </span>
                </button>
              ))
            ) : (
              <Link href="/combos" onClick={onClose}>
                <div className="rounded-xl2 border border-[var(--border)] bg-[var(--bg-elevated)] p-4 flex items-center justify-between">
                  <p className="text-sm text-[var(--text-muted)]">
                    Save meals you eat often to log them in one tap.
                  </p>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                </div>
              </Link>
            )}
          </div>
        ) : tab === "coach" ? (
          <>
            <p className="text-[13px] text-[var(--text-muted)] -mt-1 mb-3 shrink-0">
              {coachSubheading(settings.goalMode)}
            </p>
            <div ref={coachScrollRef} className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-3">
              {coachMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[14px] leading-snug ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-nova-600 to-nova-700 text-white rounded-br-sm"
                        : "glass-panel border border-[var(--border)] rounded-bl-sm"
                    }`}
                  >
                    <p>{m.text}</p>
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="mt-2.5 space-y-1.5">
                        {m.suggestions.map((s, j) => {
                          const key = `${i}-${j}`;
                          const logged = loggedSuggestions.has(key);
                          const chipStyle = getCategoryStyle(s.category);
                          const tappable = !!s.foodId;
                          return (
                            <button
                              key={j}
                              type="button"
                              onClick={() => applySuggestion(key, s)}
                              disabled={!tappable || logged}
                              className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all ${
                                tappable
                                  ? `${chipStyle.chipBg} active:scale-[0.98] disabled:opacity-60`
                                  : "bg-nova-700/6 dark:bg-nova-100/6"
                              }`}
                            >
                              {tappable && (
                                <AppIcon
                                  name={resolveFoodIconKey(s.emoji, s.category)}
                                  className={`w-4 h-4 shrink-0 ${chipStyle.chipText}`}
                                  fill="currentColor"
                                  fillOpacity={0.2}
                                  strokeWidth={1.75}
                                />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-medium truncate">{s.name}</span>
                                <span className="block text-[11px] text-[var(--text-muted)] truncate">{s.reason}</span>
                              </span>
                              {tappable &&
                                (logged ? (
                                  <CheckCircle2 className="w-4 h-4 shrink-0 text-aurora-500" />
                                ) : (
                                  <Plus className={`w-4 h-4 shrink-0 ${chipStyle.chipText}`} />
                                ))}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {coachLoading && (
                <div className="flex justify-start">
                  <div className="glass-panel border border-[var(--border)] rounded-2xl rounded-bl-sm px-4 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-nova-400" />
                  </div>
                </div>
              )}
              {coachMessages.length === 1 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {coachQuickPrompts(settings.goalMode).map((ex) => (
                    <button
                      key={ex}
                      onClick={() => sendCoach(ex)}
                      className="text-xs px-3 py-1.5 rounded-full bg-nova-700/8 hover:bg-nova-700/14 text-[var(--text-muted)] transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-end gap-2 pt-2 border-t border-[var(--border)]">
              <textarea
                value={coachText}
                onChange={(e) => setCoachText(e.target.value)}
                placeholder="Ask your coach…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[15px] focus:border-nova-500 outline-none placeholder:text-[var(--text-muted)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendCoach();
                  }
                }}
              />
              <button
                onClick={() => sendCoach()}
                disabled={coachLoading || !coachText.trim()}
                aria-label="Send"
                className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-nova-500 to-nova-700 text-white shadow-glow-nova disabled:opacity-40 active:scale-95 transition-transform"
              >
                <Send className="w-[18px] h-[18px]" />
              </button>
            </div>
            {coachMessages.length > 1 && (
              <button onClick={resetCoachConversation} className="mt-2 text-[11px] text-[var(--text-muted)] self-center">
                Start a new conversation
              </button>
            )}
          </>
        ) : (
        <>
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-snug ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-nova-600 to-nova-700 text-white rounded-br-sm"
                    : "glass-panel border border-[var(--border)] rounded-bl-sm"
                }`}
              >
                <p>{m.text}</p>
                {m.logged && m.logged.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.logged.map((l, j) => {
                      const chipStyle = getCategoryStyle(l.category);
                      return (
                        <span
                          key={j}
                          className={`inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full ${chipStyle.chipBg} ${chipStyle.chipText}`}
                        >
                          <CheckCircle2 className="w-3 h-3" />{" "}
                          <AppIcon
                            name={resolveFoodIconKey(l.emoji, l.category)}
                            className="w-3 h-3"
                            fill="currentColor"
                            fillOpacity={0.25}
                            strokeWidth={1.75}
                          />{" "}
                          {l.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="glass-panel border border-[var(--border)] rounded-2xl rounded-bl-sm px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-nova-400" />
              </div>
            </div>
          )}
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  className="text-xs px-3 py-1.5 rounded-full bg-nova-700/8 hover:bg-nova-700/14 text-[var(--text-muted)] transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-end gap-2 pt-2 border-t border-[var(--border)]">
          <div className="relative flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={listening ? "Listening…" : "Type what you ate…"}
              rows={1}
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 pr-9 text-[15px] focus:border-nova-500 outline-none placeholder:text-[var(--text-muted)]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Sparkles className="absolute right-3 top-3.5 w-4 h-4 text-aurora-500" />
          </div>
          {voiceSupported && (
            <button
              onClick={toggleMic}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              className={`h-11 w-11 shrink-0 flex items-center justify-center rounded-xl transition-colors ${
                listening ? "bg-ember-600 text-white shadow-glow-ember animate-pulse-glow" : "border border-[var(--border)] text-[var(--text-muted)]"
              }`}
            >
              {listening ? <MicOff className="w-[18px] h-[18px]" /> : <Mic className="w-[18px] h-[18px]" />}
            </button>
          )}
          <button
            onClick={() => send()}
            disabled={loading || !text.trim()}
            aria-label="Send"
            className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-nova-500 to-nova-700 text-white shadow-glow-nova disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
        {messages.length > 1 && (
          <button onClick={resetConversation} className="mt-2 text-[11px] text-[var(--text-muted)] self-center">
            Start a new conversation
          </button>
        )}
        </>
        )}
      </div>
    </Sheet>
  );
}
