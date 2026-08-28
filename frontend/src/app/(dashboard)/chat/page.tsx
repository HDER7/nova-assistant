"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send, Mic, Plus, Loader2, Volume2, VolumeX, Trash2, MessageSquare, User as UserIcon, Radio,
} from "lucide-react";
import { api, streamChat } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { ArcReactor } from "@/components/ArcReactor";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { VoiceWave } from "@/components/VoiceWave";
import { speak, cancelSpeech, ttsSupported, preloadVoices } from "@/lib/speech";
import { playBlip, playListen } from "@/lib/sound";
import type { Conversation, Message } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt?: string;
}

const STREAMING_ID = "__streaming__";

/** Pick a MediaRecorder mime type the current browser actually supports. */
function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}
const SUGGESTIONS = [
  "Recuerda que prefiero los informes en inglés",
  "¿Qué reputación tiene 8.8.8.8 en VirusTotal?",
  "Busca el CVE-2024-3094 y créame una tarea para parchear",
  "Escríbeme un script de Python que extraiga IOCs de un log",
];

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const pushToast = useUIStore((s) => s.pushToast);
  const lang = user?.locale === "en" ? "en-US" : "es-ES";
  const sttLang = user?.locale === "en" ? "en" : "es";

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
  const [hfAnalyser, setHfAnalyser] = useState<AnalyserNode | null>(null);
  const [model, setModel] = useState("auto");
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);

  const endRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const speakRef = useRef(false);
  speakRef.current = speakReplies || handsFree;
  const handsFreeRef = useRef(false);
  handsFreeRef.current = handsFree;
  const streamingRef = useRef(false);
  streamingRef.current = streaming;
  const sendRef = useRef<(t?: string) => void>(() => {});
  const speakingRef = useRef(false);
  const cooldownRef = useRef(0);

  // Hands-free VAD (voice activity detection) engine — works in any browser via MediaRecorder + Whisper.
  const hfStreamRef = useRef<MediaStream | null>(null);
  const hfCtxRef = useRef<AudioContext | null>(null);
  const hfRecRef = useRef<MediaRecorder | null>(null);
  const hfChunksRef = useRef<Blob[]>([]);
  const hfRafRef = useRef<number>(0);
  const hfStateRef = useRef<"idle" | "listening" | "recording" | "busy">("idle");
  const speechStartRef = useRef(0);
  const silenceStartRef = useRef(0);
  const hfMimeRef = useRef<string>("");

  useEffect(() => {
    preloadVoices();
    setVoiceOk(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  const speakReply = useCallback((text: string) => {
    const resume = () => {
      speakingRef.current = false;
      cooldownRef.current = Date.now() + 600; // ignore the tail NOVA just spoke
      if (handsFreeRef.current && hfStateRef.current === "busy") hfStateRef.current = "listening";
    };
    if (!text) { resume(); return; }
    speakingRef.current = true;
    speak(text, lang, resume);
  }, [lang]);

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

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setInput("");
    cancelSpeech();
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
    if (!text || streaming) return;
    playBlip();

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "USER", content: text },
      { id: STREAMING_ID, role: "ASSISTANT", content: "" },
    ]);
    setInput("");
    setStreaming(true);

    let finalText = "";
    await streamChat(
      { conversationId: activeId, message: text, model },
      {
        onMeta: (cid) => {
          if (!activeId) setActiveId(cid);
        },
        onToken: (t) => {
          finalText += t;
          setMessages((prev) => prev.map((m) => (m.id === STREAMING_ID ? { ...m, content: m.content + t } : m)));
        },
        onDone: (msg) => {
          const done = msg as Message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === STREAMING_ID
                ? { id: done.id, role: "ASSISTANT", content: done.content, createdAt: done.createdAt }
                : m
            )
          );
          setStreaming(false);
          loadConversations();
          if (speakRef.current) speakReply(done.content || finalText);
        },
        onError: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === STREAMING_ID ? { ...m, content: "⚠️ No se pudo obtener respuesta. Inténtalo de nuevo." } : m
            )
          );
          setStreaming(false);
        },
      }
    );
  }

  sendRef.current = send;

  const transcribe = useCallback(async (blob: Blob): Promise<string> => {
    if (!blob || blob.size < 1400) return "";
    const mime = hfMimeRef.current || blob.type || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.append("file", blob, `audio.${ext}`);
    form.append("language", sttLang);
    try {
      const res = await api.postForm<{ text: string }>("/api/voice/transcribe", form);
      return (res.text || "").trim();
    } catch {
      return "";
    }
  }, [sttLang]);

  const stopHandsFree = useCallback(() => {
    cancelAnimationFrame(hfRafRef.current);
    try { if (hfRecRef.current?.state === "recording") hfRecRef.current.stop(); } catch { /* ignore */ }
    hfRecRef.current = null;
    hfStreamRef.current?.getTracks().forEach((t) => t.stop());
    hfStreamRef.current = null;
    try { void hfCtxRef.current?.close(); } catch { /* ignore */ }
    hfCtxRef.current = null;
    hfStateRef.current = "idle";
    setHfAnalyser(null);
  }, []);

  // Browser-agnostic hands-free: mic + voice-activity detection + Whisper transcription.
  useEffect(() => {
    if (!handsFree) { stopHandsFree(); return; }
    let cancelled = false;

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        pushToast({ title: "No se pudo acceder al micrófono", variant: "error" });
        setHandsFree(false);
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      hfStreamRef.current = stream;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      hfCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      setHfAnalyser(analyser);
      hfMimeRef.current = pickAudioMime();
      hfStateRef.current = "listening";

      const buf = new Uint8Array(analyser.fftSize);
      const SPEECH_ON = 0.05;
      const SPEECH_OFF = 0.03;
      const SILENCE_MS = 850;
      const MAX_MS = 12000;

      const startUtterance = () => {
        try {
          hfChunksRef.current = [];
          const rec = hfMimeRef.current
            ? new MediaRecorder(stream, { mimeType: hfMimeRef.current })
            : new MediaRecorder(stream);
          rec.ondataavailable = (e) => { if (e.data.size > 0) hfChunksRef.current.push(e.data); };
          rec.onstop = async () => {
            const blob = new Blob(hfChunksRef.current, { type: hfMimeRef.current || "audio/webm" });
            const text = await transcribe(blob);
            if (!handsFreeRef.current) return;
            let t = text;
            if (t && t.length > 1) {
              const low = t.toLowerCase();
              const idx = low.indexOf("nova");
              if (idx >= 0 && idx < 6) t = t.slice(idx + 4).replace(/^[\s,.:;!?-]+/, "").trim();
            }
            if (t && t.length > 1) { playListen(); sendRef.current(t); }
            else hfStateRef.current = "listening";
          };
          rec.start();
          hfRecRef.current = rec;
        } catch {
          hfStateRef.current = "listening";
        }
      };

      const endUtterance = () => {
        hfStateRef.current = "busy";
        try { if (hfRecRef.current?.state === "recording") hfRecRef.current.stop(); } catch { /* ignore */ }
      };

      const frame = () => {
        hfRafRef.current = requestAnimationFrame(frame);
        if (hfStateRef.current === "busy") return;
        if (streamingRef.current || speakingRef.current) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();

        if (hfStateRef.current === "listening") {
          if (rms > SPEECH_ON && now > cooldownRef.current) {
            speechStartRef.current = now;
            silenceStartRef.current = 0;
            hfStateRef.current = "recording";
            startUtterance();
          }
        } else if (hfStateRef.current === "recording") {
          if (rms < SPEECH_OFF) {
            if (!silenceStartRef.current) silenceStartRef.current = now;
            else if (now - silenceStartRef.current > SILENCE_MS) endUtterance();
          } else {
            silenceStartRef.current = 0;
          }
          if (now - speechStartRef.current > MAX_MS) endUtterance();
        }
      };
      hfRafRef.current = requestAnimationFrame(frame);
    })();

    return () => { cancelled = true; stopHandsFree(); };
  }, [handsFree, transcribe, stopHandsFree, pushToast]);

  async function toggleMic() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md || !md.getUserMedia || typeof MediaRecorder === "undefined") {
      pushToast({ title: "Tu navegador no soporta grabación de audio", variant: "error" });
      return;
    }
    try {
      const stream = await md.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("file", blob, "audio.webm");
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
      <aside className="hidden flex-col rounded-2xl border border-border bg-surface/60 lg:flex">
        <button onClick={newConversation} className="nova-btn-primary m-3">
          <Plus className="h-4 w-4" /> Nueva conversación
        </button>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConversation(c.id)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
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

      <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface/40">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <ArcReactor size={130} active={streaming} />
              <div>
                <h2 className="text-xl font-semibold glow-text">NOVA está lista</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Habla o escribe. Investigo IOCs, ejecuto acciones, programo y recuerdo lo importante.
                </p>
              </div>
              <div className="grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-border bg-background/40 px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
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
                className="rounded-lg border border-border bg-background/60 px-2 py-1 text-xs outline-none focus:border-primary"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={() => setSpeakReplies((v) => { if (v) cancelSpeech(); return !v; })}
              title={speakReplies ? "Voz activada" : "Voz desactivada"}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border transition",
                speakReplies ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
                !ttsSupported() && "hidden"
              )}
            >
              {speakReplies ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>

            <button
              onClick={() => setHandsFree((v) => !v)}
              title={handsFree ? "Manos libres activo — habla con naturalidad" : "Modo manos libres (conversación por voz)"}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border transition",
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
              disabled={transcribing}
              title="Hablar (Whisper)"
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border transition",
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
              <VoiceWave active={handsFree} analyser={hfAnalyser} />
              <p className="text-xs uppercase tracking-[0.14em] text-primary">
                {streaming || transcribing ? "Procesando…" : "Escuchando — habla con naturalidad"}
              </p>
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
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
          isUser ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : "N"}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser ? "bg-accent/12 text-foreground" : "glass text-foreground"
        )}
      >
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
