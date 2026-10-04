"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Send, Mic, Plus, Loader2, Volume2, VolumeX, Trash2, MessageSquare, User as UserIcon, Radio, Crosshair,
} from "lucide-react";
import { api, streamChat } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { ArcReactor } from "@/components/ArcReactor";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { VoiceWave } from "@/components/VoiceWave";
import { ToolChip } from "@/components/HoloCard";
import { SentenceSpeaker, cancelAll, ttsAvailable, warmUpVoices } from "@/lib/tts";
import { useVoiceLoop, voiceCaptureSupported, type VoicePhase } from "@/lib/useVoiceLoop";
import { playBlip } from "@/lib/sound";
import type { Conversation, Message, ToolCard } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
  tools?: ToolCard[];
}

const STREAMING_ID = "__streaming__";

function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

const SUGGESTIONS = [
  "NOVA, protocolo inicio de turno",
  "¿Qué reputación tiene 8.8.8.8 en VirusTotal?",
  "Busca el CVE-2024-3094 y créame una tarea para parchear",
  "¿Qué vulnerabilidades explotadas salieron esta semana?",
];

const PHASE_LABEL: Record<VoicePhase, string> = {
  off: "",
  calibrating: "Calibrando ruido ambiente… silencio un momento",
  listening: "Escuchando — habla con naturalidad",
  recording: "Te escucho…",
  transcribing: "Procesando…",
  responding: "Respondiendo — háblale para interrumpir",
};

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const pushToast = useUIStore((s) => s.pushToast);
  const lang = user?.locale === "en" ? "en-US" : "es-ES";
  const sttLang = user?.locale === "en" ? "en" : "es";
  const persona = (user?.persona || "JARVIS").toUpperCase();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [model, setModel] = useState("auto");
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);

  const endRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const streamingRef = useRef(false);
  streamingRef.current = streaming;
  const speakRef = useRef(false);
  speakRef.current = speakReplies || handsFree;
  const abortRef = useRef<AbortController | null>(null);
  const sendRef = useRef<(t?: string) => void>(() => {});

  useEffect(() => {
    warmUpVoices();
    setVoiceOk(voiceCaptureSupported());
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const list = await api.get<Conversation[]>("/api/conversations");
      setConversations(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    cancelAll();
    setActiveId(id);
    try {
      const msgs = await api.get<Message[]>(`/api/conversations/${id}/messages`);
      setMessages(msgs.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })));
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    loadConversations().then((list) => {
      if (list.length > 0) selectConversation(list[0].id);
    });
  }, [loadConversations, selectConversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    api.get<{ models: { id: string; label: string }[] }>("/api/chat/models").then((r) => setModels(r.models)).catch(() => {});
  }, []);

  useEffect(() => () => cancelAll(), []);

  function newConversation() {
    abortRef.current?.abort();
    cancelAll();
    setActiveId(null);
    setMessages([]);
    setInput("");
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await api.del(`/api/conversations/${id}`);
      const list = await loadConversations();
      if (activeId === id) {
        if (list.length > 0) selectConversation(list[0].id);
        else newConversation();
      }
    } catch {
      pushToast({ title: "No se pudo eliminar", variant: "error" });
    }
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || streamingRef.current) return;
    playBlip();
    cancelAll();

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "USER", content: text },
      { id: STREAMING_ID, role: "ASSISTANT", content: "", tools: [] },
    ]);
    setInput("");
    setStreaming(true);
    streamingRef.current = true;

    const speaker = speakRef.current && ttsAvailable() ? new SentenceSpeaker({ lang, persona }) : null;
    const controller = new AbortController();
    abortRef.current = controller;

    const finalize = (patch: Partial<ChatMessage> & { id?: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === STREAMING_ID ? { ...m, ...patch } : m)));
      setStreaming(false);
      streamingRef.current = false;
      abortRef.current = null;
    };

    await streamChat(
      { conversationId: activeId, message: text, model },
      {
        onMeta: (cid) => {
          if (!activeId) setActiveId(cid);
        },
        onToken: (t) => {
          speaker?.push(t);
          setMessages((prev) => prev.map((m) => (m.id === STREAMING_ID ? { ...m, content: m.content + t } : m)));
        },
        onTool: (card) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== STREAMING_ID) return m;
              const tools = [...(m.tools || [])];
              const i = tools.findIndex((c) => c.id === card.id);
              if (i >= 0) tools[i] = card;
              else tools.push(card);
              return { ...m, tools };
            })
          );
        },
        onDone: (msg) => {
          const done = msg as Message;
          speaker?.flush();
          finalize({ id: done.id, content: done.content, createdAt: done.createdAt });
          loadConversations();
        },
        onAbort: () => {
          finalize({ id: `a-${Date.now()}` });
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 && m.role === "ASSISTANT" && !m.content.endsWith("(interrumpido)")
                ? { ...m, content: (m.content ? m.content + " " : "") + "— (interrumpido)" }
                : m
            )
          );
          loadConversations();
        },
        onError: () => {
          speaker?.flush();
          finalize({ id: `e-${Date.now()}`, content: "⚠️ No se pudo obtener respuesta. Inténtalo de nuevo." });
        },
      },
      true,
      controller.signal
    );
  }
  sendRef.current = send;

  // ---------------- Hands-free (VAD + Whisper, any browser) with barge-in ----------------
  const voice = useVoiceLoop({
    enabled: handsFree,
    sttLang,
    isBusy: () => streamingRef.current,
    onUtterance: (t) => sendRef.current(t),
    onBargeIn: () => abortRef.current?.abort(),
    onError: (m) => {
      pushToast({ title: m, variant: "error" });
      setHandsFree(false);
    },
  });

  // ---------------- Push-to-talk (Whisper) ----------------
  async function toggleMic() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!voiceCaptureSupported()) {
      pushToast({ title: "Tu navegador no soporta grabación de audio", variant: "error" });
      return;
    }
    try {
      cancelAll();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = pickAudioMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const ext = (mime || "webm").includes("mp4") ? "mp4" : (mime || "").includes("ogg") ? "ogg" : "webm";
          const form = new FormData();
          form.append("file", blob, `audio.${ext}`);
          form.append("language", sttLang);
          const res = await api.postForm<{ text: string }>("/api/voice/transcribe", form);
          const t = (res.text || "").trim();
          if (t) send(t);
          else pushToast({ title: "No se entendió el audio", variant: "default" });
        } catch {
          pushToast({ title: "No se pudo transcribir el audio", variant: "error" });
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      pushToast({ title: "No se pudo acceder al micrófono", variant: "error" });
    }
  }

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="hidden flex-col rounded-lg border border-border bg-surface/60 lg:flex">
        <button onClick={newConversation} className="nova-btn-primary m-3">
          <Plus className="h-4 w-4" /> Nueva conversación
        </button>
        <Link href="/hud" className="nova-btn-ghost mx-3 mb-2">
          <Crosshair className="h-4 w-4" /> Modo HUD
        </Link>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConversation(c.id)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                activeId === c.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"
              )}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{c.title}</span>
              <Trash2
                onClick={(e) => deleteConversation(c.id, e)}
                className="h-3.5 w-3.5 opacity-0 transition hover:text-danger group-hover:opacity-100"
              />
            </button>
          ))}
        </div>
      </aside>

      <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface/40">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <ArcReactor size={130} active={streaming} />
              <div>
                <h2 className="text-xl font-semibold">NOVA está lista</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Habla o escribe. Investigo IOCs, ejecuto acciones y protocolos, programo y recuerdo lo importante.
                </p>
              </div>
              <div className="grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-md border border-border bg-background/40 px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} streaming={streaming && m.id === STREAMING_ID} />)
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border bg-surface/60 p-3 md:p-4">
          {models.length > 0 && (
            <div className="mb-2 flex items-center justify-end gap-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Modelo</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-md border border-border bg-background/60 px-2 py-1 text-xs outline-none focus:border-primary"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={() => setSpeakReplies((v) => { if (v) cancelAll(); return !v; })}
              title={speakReplies ? "Voz activada" : "Voz desactivada"}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border transition",
                speakReplies ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                !ttsAvailable() && "hidden"
              )}
            >
              {speakReplies ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>

            <button
              onClick={() => setHandsFree((v) => { if (v) cancelAll(); return !v; })}
              title={handsFree ? "Manos libres activo — habla con naturalidad" : "Modo manos libres (conversación por voz)"}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border transition",
                handsFree ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                !voiceOk && "hidden"
              )}
            >
              <Radio className={cn("h-5 w-5", handsFree && "animate-pulse")} />
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Escribe un mensaje a NOVA…"
              className="nova-input max-h-40 min-h-[44px] flex-1 resize-none py-3"
            />

            <button
              onClick={toggleMic}
              disabled={transcribing || handsFree}
              title="Hablar (Whisper)"
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border transition",
                recording ? "animate-pulse bg-danger/20 text-danger" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {transcribing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
            </button>

            <button onClick={() => send()} disabled={streaming || !input.trim()} className="nova-btn-primary h-11 w-11 shrink-0 !px-0">
              {streaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          {handsFree && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <VoiceWave active={handsFree} analyser={voice.analyser} />
              <p className="text-xs uppercase tracking-[0.14em] text-primary">{PHASE_LABEL[voice.phase] || "Activando micrófono…"}</p>
            </div>
          )}
          {recording && <p className="mt-2 text-center text-xs text-danger">● Grabando… pulsa el micrófono para terminar</p>}
          {transcribing && <p className="mt-2 text-center text-xs text-primary">Transcribiendo con Whisper…</p>}
        </div>
      </section>
    </div>
  );
}

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
  const isUser = message.role === "USER";
  return (
    <div className={cn("flex animate-fade-up gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
          isUser ? "bg-muted text-foreground" : "bg-primary/15 text-primary"
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <ArcReactor size={22} />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed",
          isUser ? "bg-muted/60 text-foreground" : "glass text-foreground"
        )}
      >
        {!isUser && message.tools && message.tools.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {message.tools.map((c) => (
              <ToolChip key={c.id} card={c} />
            ))}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <ChatMarkdown content={message.content} />
            {streaming && <span className="typing-caret" />}
          </>
        )}
        {message.createdAt && <p className="mt-1.5 text-[10px] text-muted-foreground">{relativeTime(message.createdAt)}</p>}
      </div>
    </div>
  );
}
