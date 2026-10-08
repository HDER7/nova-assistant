"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen, Plus, Trash2, Upload, FileText, Loader2, Send, Headphones, ClipboardPaste, X, ShieldAlert,
} from "lucide-react";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { cn, relativeTime } from "@/lib/utils";

interface SourceInfo { id: string; title: string; kind: string; chars: number; preview: string; createdAt: string }
interface NotebookSummary { id: string; title: string; sources: number; updatedAt: string; hasAudio: boolean }
interface NotebookDetail {
  id: string; title: string; sources: SourceInfo[]; totalChars: number;
  hasAudio: boolean; audioTitle?: string | null; audioAt?: string | null;
}
interface QA { role: "user" | "assistant"; content: string; citations?: { index: number; title: string }[] }

const SUGGESTED = [
  "Resume las ideas clave de las fuentes",
  "¿Qué riesgos o vulnerabilidades se mencionan?",
  "Crea una guía de estudio con preguntas y respuestas",
  "¿Qué acciones recomiendan las fuentes?",
];

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function NotebooksPage() {
  const pushToast = useUIStore((s) => s.pushToast);
  const [list, setList] = useState<NotebookSummary[]>([]);
  const [active, setActive] = useState<NotebookDetail | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [qa, setQa] = useState<Record<string, QA[]>>({});
  const [question, setQuestion] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const l = await api.get<NotebookSummary[]>("/api/notebooks");
      setList(l);
      return l;
    } catch {
      return [];
    }
  }, []);

  const open = useCallback(async (id: string) => {
    setAudioUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    try {
      setActive(await api.get<NotebookDetail>(`/api/notebooks/${id}`));
    } catch (e) {
      pushToast({ title: errMsg(e, "No se pudo abrir el cuaderno"), variant: "error" });
    }
  }, [pushToast]);

  useEffect(() => {
    load().then((l) => {
      if (l.length) open(l[0].id);
    });
  }, [load, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qa, active?.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const nb = await api.post<NotebookDetail>("/api/notebooks", { title: newTitle.trim() });
      setNewTitle("");
      await load();
      setActive(nb);
    } catch (e2) {
      pushToast({ title: errMsg(e2, "No se pudo crear"), variant: "error" });
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este cuaderno y sus fuentes?")) return;
    try {
      await api.del(`/api/notebooks/${id}`);
      const l = await load();
      if (active?.id === id) {
        setActive(null);
        if (l.length) open(l[0].id);
      }
    } catch (e) {
      pushToast({ title: errMsg(e, "No se pudo eliminar"), variant: "error" });
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!active || !files?.length) return;
    setBusy("upload");
    try {
      let nb = active;
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f, f.name);
        nb = await api.postForm<NotebookDetail>(`/api/notebooks/${active.id}/sources/file`, form);
      }
      setActive(nb);
      load();
      pushToast({ title: "Fuente añadida", variant: "success" });
    } catch (e) {
      pushToast({ title: errMsg(e, "No se pudo añadir la fuente"), variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function addPasted(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !pasteText.trim()) return;
    setBusy("paste");
    try {
      const nb = await api.post<NotebookDetail>(`/api/notebooks/${active.id}/sources/text`, {
        title: pasteTitle.trim() || "Texto pegado",
        content: pasteText,
      });
      setActive(nb);
      setPasteOpen(false);
      setPasteTitle("");
      setPasteText("");
      load();
    } catch (e2) {
      pushToast({ title: errMsg(e2, "No se pudo añadir el texto"), variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function removeSource(sid: string) {
    if (!active) return;
    try {
      setActive(await api.del<NotebookDetail>(`/api/notebooks/${active.id}/sources/${sid}`));
      load();
    } catch (e) {
      pushToast({ title: errMsg(e, "No se pudo eliminar la fuente"), variant: "error" });
    }
  }

  async function ask(text?: string) {
    if (!active) return;
    const q = (text ?? question).trim();
    if (!q || busy === "ask") return;
    const id = active.id;
    const history = qa[id] || [];
    setQa((m) => ({ ...m, [id]: [...history, { role: "user", content: q }] }));
    setQuestion("");
    setBusy("ask");
    try {
      const res = await api.post<{ answer: string; citations: { index: number; title: string }[] }>(
        `/api/notebooks/${id}/ask`,
        { question: q, history: history.map((h) => ({ role: h.role, content: h.content })) }
      );
      setQa((m) => ({ ...m, [id]: [...(m[id] || []), { role: "assistant", content: res.answer, citations: res.citations }] }));
    } catch (e) {
      setQa((m) => ({ ...m, [id]: [...(m[id] || []), { role: "assistant", content: "⚠️ " + errMsg(e, "No se pudo responder.") }] }));
    } finally {
      setBusy(null);
    }
  }

  async function fetchAudio(id: string) {
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(`${API_URL}/api/notebooks/${id}/audio`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("No se pudo descargar el audio");
    const blob = await res.blob();
    setAudioUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
  }

  async function generateAudio() {
    if (!active) return;
    setBusy("audio");
    try {
      const nb = await api.post<NotebookDetail>(`/api/notebooks/${active.id}/audio`, {});
      setActive(nb);
      await fetchAudio(nb.id);
      load();
      pushToast({ title: "Resumen en audio listo", variant: "success" });
    } catch (e) {
      pushToast({ title: errMsg(e, "No se pudo generar el audio"), variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const conv = active ? qa[active.id] || [] : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* notebooks list */}
      <aside className="space-y-3">
        <div className="nova-card space-y-3 !p-4">
          <h1 className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4 text-primary" /> Cuadernos</h1>
          <form onSubmit={create} className="flex gap-2">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="nova-input !py-2" placeholder="Nuevo cuaderno…" maxLength={160} />
            <button type="submit" disabled={!newTitle.trim()} className="nova-btn-primary shrink-0 !px-3"><Plus className="h-4 w-4" /></button>
          </form>
          <div className="space-y-1">
            {list.length === 0 && <p className="py-2 text-xs text-muted-foreground">Crea tu primer cuaderno.</p>}
            {list.map((n) => (
              <button
                key={n.id}
                onClick={() => open(n.id)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                  active?.id === n.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"
                )}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{n.title}</span>
                <span className="text-[10px]">{n.sources}</span>
                <Trash2
                  onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                  className="h-3.5 w-3.5 opacity-0 transition hover:text-danger group-hover:opacity-100"
                />
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 rounded-md border border-border bg-surface/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          Las fuentes se envían a Google Gemini (plan gratuito, puede usarse para mejorar sus modelos). No subas datos de clientes ni información confidencial.
        </div>
      </aside>

      {!active ? (
        <section className="nova-card flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <BookOpen className="h-10 w-10 text-primary" />
          <h2 className="text-lg font-semibold">Modo cuaderno</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Sube informes, PDFs, logs o notas. NOVA responde solo con base en tus fuentes, cita de dónde sale cada dato
            y puede crear un resumen en audio estilo podcast.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
          {/* sources + audio */}
          <div className="space-y-4">
            <div className="nova-card space-y-3 !p-4">
              <div className="flex items-center justify-between">
                <h2 className="truncate font-semibold">{active.title}</h2>
                <span className="nova-chip">{Math.round(active.totalChars / 1000)}k car.</span>
              </div>
              <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.txt,.md,.csv,.json,.log,.xml,.html,text/*,application/pdf"
                onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
              <div className="flex gap-2">
                <button onClick={() => fileRef.current?.click()} disabled={busy === "upload"} className="nova-btn-ghost flex-1 !py-2 text-xs">
                  {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir archivo
                </button>
                <button onClick={() => setPasteOpen((v) => !v)} className="nova-btn-ghost flex-1 !py-2 text-xs">
                  <ClipboardPaste className="h-4 w-4" /> Pegar texto
                </button>
              </div>
              {pasteOpen && (
                <form onSubmit={addPasted} className="space-y-2 rounded-md border border-border bg-background/40 p-2">
                  <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} className="nova-input !py-2 text-xs" placeholder="Título de la fuente" maxLength={200} />
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="nova-input min-h-[120px] text-xs" placeholder="Pega aquí el texto…" />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setPasteOpen(false)} className="nova-btn-ghost !px-3 !py-1.5 text-xs"><X className="h-3.5 w-3.5" /></button>
                    <button type="submit" disabled={busy === "paste" || !pasteText.trim()} className="nova-btn-primary !px-3 !py-1.5 text-xs">
                      {busy === "paste" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Añadir"}
                    </button>
                  </div>
                </form>
              )}
              <div className="max-h-[320px] space-y-2 overflow-y-auto">
                {active.sources.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">Sin fuentes todavía.</p>}
                {active.sources.map((s, i) => (
                  <div key={s.id} className="group rounded-md border border-border bg-background/40 p-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary/15 text-[10px] font-semibold text-primary">{i + 1}</span>
                      <p className="flex-1 truncate text-xs font-medium" title={s.title}>{s.title}</p>
                      <button onClick={() => removeSource(s.id)} className="text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{s.preview}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="nova-card space-y-3 !p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Headphones className="h-4 w-4 text-primary" /> Resumen en audio</h3>
              <p className="text-xs text-muted-foreground">Dos presentadores comentan tus fuentes en unos 2–3 minutos.</p>
              {active.hasAudio && !audioUrl && (
                <button onClick={() => fetchAudio(active.id).catch(() => pushToast({ title: "No se pudo cargar el audio", variant: "error" }))} className="nova-btn-ghost w-full !py-2 text-xs">
                  <Headphones className="h-4 w-4" /> Escuchar “{active.audioTitle || "resumen"}”
                </button>
              )}
              {audioUrl && <audio src={audioUrl} controls autoPlay className="w-full" />}
              <button onClick={generateAudio} disabled={busy === "audio" || active.sources.length === 0} className="nova-btn-primary w-full !py-2 text-xs">
                {busy === "audio" ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando (puede tardar ~1 min)…</> : active.hasAudio ? "Regenerar resumen" : "Generar resumen en audio"}
              </button>
            </div>
          </div>

          {/* grounded Q&A */}
          <div className="nova-card flex min-h-[60vh] flex-col !p-0">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {conv.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">Pregunta sobre tus fuentes. Cada respuesta cita de dónde sale.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SUGGESTED.map((s) => (
                      <button key={s} onClick={() => ask(s)} disabled={active.sources.length === 0}
                        className="rounded-md border border-border bg-background/40 px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-40">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                conv.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" && "justify-end")}>
                    <div className={cn("max-w-[85%] rounded-lg px-4 py-3 text-sm", m.role === "user" ? "bg-muted/60" : "glass")}>
                      {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <ChatMarkdown content={m.content} />}
                      {m.citations && m.citations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.citations.map((c) => (
                            <span key={c.index} className="nova-chip" title={c.title}>[{c.index}] {c.title.length > 28 ? c.title.slice(0, 28) + "…" : c.title}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {busy === "ask" && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo tus fuentes…</p>}
              <div ref={endRef} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2 border-t border-border p-3">
              <input value={question} onChange={(e) => setQuestion(e.target.value)} className="nova-input"
                placeholder={active.sources.length ? "Pregunta sobre las fuentes…" : "Añade una fuente para empezar"} disabled={!active.sources.length} />
              <button type="submit" disabled={busy === "ask" || !question.trim() || !active.sources.length} className="nova-btn-primary shrink-0 !px-3">
                <Send className="h-4 w-4" />
              </button>
            </form>
            {active.audioAt && <p className="px-3 pb-2 text-[10px] text-muted-foreground">Último audio: {relativeTime(active.audioAt)}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
