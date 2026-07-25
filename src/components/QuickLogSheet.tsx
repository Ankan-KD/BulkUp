"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "./ui/sheet";
import { useStore } from "@/lib/store";
import { FoodTemplate } from "@/lib/types";
import { AppIcon } from "@/lib/icons";
import { Sparkles, Send, Mic, MicOff, Loader2, CheckCircle2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  logged?: { name: string; emoji: string }[];
}

interface ChatAction {
  type: "log_existing" | "create_and_log";
  foodId?: string;
  name: string;
  emoji?: string;
  quantityConsumed: number;
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
}

const GREETING: ChatMessage = {
  role: "assistant",
  text: "Tell me what you ate — one thing or ten, in your own words. I'll figure out the rest 🌱",
};

const EXAMPLES = ["I had chicken biriyani", "3 eggs and a glass of milk", "Finished half my chicken"];

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
  const { foods, addQuantity, logQuantity, createAndLogFood } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const foodsRef = useRef(foods);
  const baseTextRef = useRef("");        // text that existed before this mic session started
  const finalTranscriptRef = useRef(""); // finalized speech accumulated during this session
  const manualStopRef = useRef(false);   // true only when the user explicitly presses mic-off
  foodsRef.current = foods;

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
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const chunk = result[0]?.transcript ?? "";
          if (result.isFinal) {
            finalTranscriptRef.current = [finalTranscriptRef.current, chunk.trim()]
              .filter(Boolean)
              .join(" ");
          } else {
            interim += chunk;
          }
        }
        const committed = [baseTextRef.current, finalTranscriptRef.current].filter(Boolean).join(" ");
        setText(interim ? [committed, interim].filter(Boolean).join(" ") : committed);
      };
  
      rec.onerror = (e: any) => {
        // Only truly fatal errors should stop listening; transient ones
        // ("no-speech", "aborted") are handled by the onend restart below.
        if (e?.error === "not-allowed" || e?.error === "audio-capture" || e?.error === "service-not-allowed") {
          manualStopRef.current = true;
          setListening(false);
        }
      };
  
      rec.onend = () => {
        if (manualStopRef.current) {
          setListening(false);
          return;
        }
        // Chrome periodically ends sessions on its own even mid-speech —
        // restart automatically since the user hasn't pressed mic-off.
        try {
          rec.start();
        } catch {
          // Can throw if start() is called too quickly after end(); ignore.
        }
      };
  
      recognitionRef.current = rec;
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function toggleMic() {
    if (!recognitionRef.current) return;
    if (listening) {
      manualStopRef.current = true;
      recognitionRef.current.stop();
      setListening(false);
    } else {
      manualStopRef.current = false;
      baseTextRef.current = text; // keep whatever was already typed/dictated
      finalTranscriptRef.current = "";
      recognitionRef.current.start();
      setListening(true);
    }
  }

  async function applyAction(action: ChatAction): Promise<{ name: string; emoji: string }> {
    if (action.type === "log_existing" && action.foodId) {
      const food = foodsRef.current.find((f) => f.id === action.foodId);
      if (food) {
        if (food.kind === "binary") {
          logQuantity(food.id, food.targetQuantity);
        } else {
          addQuantity(food.id, action.quantityConsumed);
        }
        return { name: food.name, emoji: food.emoji };
      }
    }

    // create_and_log, or a log_existing whose foodId didn't resolve (model
    // hallucinated an id) — either way, create a fresh food and log it now.
    const newFood: Omit<FoodTemplate, "id" | "sortOrder"> = {
      name: action.name,
      emoji: action.emoji || "Utensils",
      targetQuantity: action.targetQuantity ?? 1,
      unit: (action.unit as FoodTemplate["unit"]) ?? "serving",
      calories: action.calories ?? 0,
      protein: action.protein ?? 0,
      carbs: action.carbs ?? 0,
      fats: action.fats ?? 0,
      aliases: action.aliases ?? [],
      archived: false,
      kind: (action.kind as FoodTemplate["kind"]) ?? "binary",
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      category: (action.category as FoodTemplate["category"]) ?? "other",
      customCategory: action.customCategory ?? "",
      baseIngredient: action.baseIngredient ?? action.name.toLowerCase(),
    };
    await createAndLogFood(newFood, action.quantityConsumed || newFood.targetQuantity);
    return { name: newFood.name, emoji: newFood.emoji };
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
        }),
      });
      const data = await res.json();
      const actions: ChatAction[] = Array.isArray(data.actions) ? data.actions : [];

      let logged: { name: string; emoji: string }[] = [];
      if (data.done && actions.length > 0) {
        logged = await Promise.all(actions.map(applyAction));
      }

      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.reply || "Got it.", logged: logged.length ? logged : undefined },
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

  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose();
      }}
      title="AI Quick Log"
    >
      <div className="flex flex-col h-[65vh] max-h-[560px]">
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
                    {m.logged.map((l, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full bg-aurora-500/15 text-aurora-300"
                      >
                        <CheckCircle2 className="w-3 h-3" /> <AppIcon name={l.emoji} className="w-3 h-3" /> {l.name}
                      </span>
                    ))}
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
      </div>
    </Sheet>
  );
}
