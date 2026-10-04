"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Mic, MicOff, Volume2, VolumeX, Send, Power } from "lucide-react";
import { api, streamChat } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { HudCore } from "@/components/HudCore";
import { HoloCard } from "@/components/HoloCard";
import { SentenceSpeaker, cancelAll, onSpeakingChange, ttsAvailable, warmUpVoices } from "@/lib/tts";
import { useVoiceLoop, voiceCaptureSupported, type VoicePhase } from "@/lib/useVoiceLoop";
import { playBlip, playOnline } from "@/lib/sound";
import type { ToolCard, User } from "@/lib/types";
import { cn } from "@/lib/utils";

const PERSONAS = [
  { id: "JARVIS", hint: "Formal" },
  { id: "FRIDAY", hint: "Cercana" },
  { id: "EDITH", hint: "Táctica" },
] as const;

const QUICK = ["Protocolo inicio de turno", "Protocolo radar de amenazas", "Protocolo cierre de turno", "Protocolo concentración"];

const PHASE_TEXT: Record<string, string> = {
  off: "En espera",
  calibrating: "Calibrando",
  listening: "Escuchando",
  recording: "Te escucho",
  transcribing: "Procesando",
  responding: "Pensando",
  thinking: "Pensando",
  speaking: "Hablando",
};

export default function HudPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const pushToast = useUIStore((s) => s.pushToast);
  const lang = user?.locale === "en" ? "en-US" : "es-ES";
  const sttLang = user?.locale === "en" ? "en" : "es";
  const persona = (user?.persona || "JARVIS").toUpperCase();

  const [active, setActive] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [userLine, setUserLine] = useState("");
  const [novaLine, setNovaLine] = useState("");
  const [cards, setCards] = useState<ToolCard[]>([]);
  const [typed, setTyped] = useState("");
  const [convId, setConvId] = useState<string | null>(null);

  const streamingRef = useRef(false);
  streamingRef.current = streaming;
  const voiceOnRef = useRef(true);
  voiceOnRef.current = voiceOn;
  const abortRef = useRef<AbortController | null>(null);
  const convRef = useRef<string | null>(null);
  convRef.current = convId;
  const sendRef = useRef<(t: string) => void>(() => {});

  useEffect(() => {
    warmUpVoices();
    try {
      setConvId(sessionStorage.getItem("nova.hud.conv"));
    } catch {
      /* ignore */
    }
    const off = onSpeakingChange(setSpeaking);
    return () => {
      off();
      cancelAll();
      abortRef.current?.abort();
    };
  }, []);

  async function send(text: string) {
    const t = text.trim();
    if (!t || streamingRef.current) return;
    playBlip();
    cancelAll();
    setUserLine(t);
    setNovaLine("");
    setStreaming(true);
    streamingRef.current = true;
    const speaker = voiceOnRef.current && ttsAvailable() ? new SentenceSpeaker({ lang, persona }) : null;
    const controller = new AbortController();
    abortRef.current = controller;
    const end = () => {
      setStreaming(false);
      streamingRef.current = false;
      abortRef.current = null;
    };
    await streamChat(
      { conversationId: convRef.current, message: t, model: "auto" },
      {
        onMeta: (cid) => {
          setConvId(cid);
          try {
            sessionStorage.setItem("nova.hud.conv", cid);
          } catch {
            /* ignore */
          }
        },
        onToken: (tok) => {
          speaker?.push(tok);
          setNovaLine((prev) => prev + tok);
        },
        onTool: (card) =>
          setCards((prev) => {
            const i = prev.findIndex((c) => c.id === card.id);
            if (i >= 0) {
              const next = [...prev];
              next[i] = card;
              return next;
            }
            return [card, ...prev].slice(0, 4);
          }),
        onDone: () => {
          speaker?.flush();
          end();
        },
        onAbort: () => {
          setNovaLine((prev) => (prev ? prev + " —" : prev));
          end();
        },
        onError: () => {
          setNovaLine("⚠️ No pude obtener respuesta. Inténtalo de nuevo.");
          end();
        },
      },
      true,
      controller.signal
    );
  }
  sendRef.current = send;

  const voice = useVoiceLoop({
    enabled: active,
    sttLang,
    isBusy: () => streamingRef.current,
    onUtterance: (t) => sendRef.current(t),
    onBargeIn: () => abortRef.current?.abort(),
    onError: (m) => {
      pushToast({ title: m, variant: "error" });
      setActive(false);
    },
  });

  function activate() {
    if (!voiceCaptureSupported()) {
      pushToast({ title: "Tu navegador no permite usar el micrófono", variant: "error" });
      return;
    }
    playOnline();
    setActive(true);
  }

  async function switchPersona(id: string) {
    if (id === persona) return;
    try {
      const updated = await api.patch<User>("/api/users/me/preferences", { persona: id });
      setUser(updated);
      pushToast({ title: `Personalidad: ${id}`, variant: "success" });
    } catch {
      pushToast({ title: "No se pudo cambiar la personalidad", variant: "error" });
    }
  }

  const corePhase: VoicePhase | "speaking" | "thinking" = speaking
    ? "speaking"
    : streaming
      ? "thinking"
      : voice.phase;
  const tail = novaLine.length > 320 ? "…" + novaLine.slice(-320) : novaLine;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col overflow-hidden bg-background">
      <div className="nova-backdrop" />
      <div className="hud-grid pointer-events-none absolute inset-0" />

      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-8">
        <div>
          <p className="text-sm font-semibold tracking-[0.3em]">NOVA · {persona}</p>
          <p className="nova-label mt-0.5 !text-primary">{PHASE_TEXT[corePhase] || ""}</p>
        </div>
        <div className="hidden items-center gap-1 rounded-md border border-border bg-surface/60 p-1 sm:flex">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => switchPersona(p.id)}
              title={p.hint}
              className={cn(
                "rounded-sm px-3 py-1 text-[11px] tracking-[0.18em] transition",
                persona === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.id}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceOn((v) => { if (v) cancelAll(); return !v; })}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface/60 text-muted-foreground hover:text-foreground"
            title={voiceOn ? "Silenciar a NOVA" : "Activar voz de NOVA"}
          >
            {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface/60 text-muted-foreground hover:text-foreground"
            title="Salir del HUD"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* body */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-4 lg:flex-row lg:gap-10">
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <HudCore size={300} levelRef={voice.levelRef} phase={corePhase} />
          <div className="mt-4 w-full max-w-2xl text-center">
            {userLine && <p className="nova-label mb-2 truncate">Tú · {userLine}</p>}
            <p className="hud-subtitle min-h-[3.5rem] text-lg leading-relaxed text-foreground md:text-xl">
              {tail || (active ? "Le escucho." : "Sistemas listos.")}
              {streaming && <span className="typing-caret" />}
            </p>
          </div>
        </div>

        {cards.length > 0 && (
          <aside className="flex max-h-full w-full flex-row gap-3 overflow-x-auto pb-2 lg:w-auto lg:flex-col lg:overflow-visible">
            {cards.map((c) => (
              <HoloCard key={c.id} card={c} />
            ))}
          </aside>
        )}
      </div>

      {/* bottom controls */}
      <footer className="relative z-10 flex flex-col items-center gap-3 px-4 pb-6">
        <div className="flex flex-wrap justify-center gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={streaming}
              className="nova-chip transition hover:border-primary/60 hover:text-foreground disabled:opacity-40"
            >
              {q.replace("Protocolo ", "")}
            </button>
          ))}
        </div>

        <div className="flex w-full max-w-xl items-center gap-2">
          {!active ? (
            <button onClick={activate} className="nova-btn-primary flex-1 py-3 tracking-[0.2em]">
              <Power className="h-4 w-4" /> ACTIVAR NOVA
            </button>
          ) : (
            <button
              onClick={() => { cancelAll(); setActive(false); }}
              className="nova-btn-ghost h-11 w-11 shrink-0 !px-0"
              title="Desactivar micrófono"
            >
              {voice.phase === "off" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5 text-primary" />}
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) {
                send(typed);
                setTyped("");
              }
            }}
            className={cn("flex flex-1 items-center gap-2", !active && "hidden sm:flex")}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="O escribe aquí…"
              className="nova-input h-11"
            />
            <button type="submit" disabled={streaming || !typed.trim()} className="nova-btn-primary h-11 w-11 shrink-0 !px-0">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
