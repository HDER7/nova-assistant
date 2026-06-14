"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pin, PinOff, Save, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import type { Note } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

export default function NotesPage() {
  const pushToast = useUIStore((s) => s.pushToast);
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "" });

  async function load() {
    try {
      setNotes(await api.get<Note[]>("/api/notes"));
    } catch {
      /* silent */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && !title.trim()) return;
    setLoading(true);
    try {
      await api.post("/api/notes", {
        title: title || "Nota",
        content,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      setTitle("");
      setContent("");
      setTags("");
      load();
      pushToast({ title: "Nota guardada", variant: "success" });
    } catch {
      pushToast({ title: "No se pudo guardar", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function togglePin(n: Note) {
    await api.patch(`/api/notes/${n.id}`, { pinned: !n.pinned });
    load();
  }
  async function remove(id: string) {
    await api.del(`/api/notes/${id}`);
    load();
  }
  function startEdit(n: Note) {
    setEditing(n.id);
    setDraft({ title: n.title, content: n.content });
  }
  async function saveEdit(id: string) {
    await api.patch(`/api/notes/${id}`, draft);
    setEditing(null);
    load();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Notas</h1>
        <p className="text-sm text-muted-foreground">Captura ideas; NOVA las mantiene a salvo.</p>
      </header>

      <form onSubmit={create} className="nova-card space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="nova-input" placeholder="Título" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="nova-input resize-none" placeholder="Escribe tu nota…" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="nova-input flex-1" placeholder="Etiquetas (separadas por comas)" />
          <button type="submit" disabled={loading} className="nova-btn-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar nota
          </button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((n) => (
          <div key={n.id} className={cn("nova-card group", n.pinned && "glow-border")}>
            {editing === n.id ? (
              <div className="space-y-2">
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="nova-input" />
                <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={5} className="nova-input resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(n.id)} className="nova-btn-primary flex-1"><Save className="h-4 w-4" /> Guardar</button>
                  <button onClick={() => setEditing(null)} className="nova-btn-ghost"><X className="h-4 w-4" /></button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <h3 className="font-medium">{n.title}</h3>
                  <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => togglePin(n)} className="text-muted-foreground hover:text-primary">
                      {n.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>
                    <button onClick={() => remove(n.id)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <p onClick={() => startEdit(n)} className="mt-2 cursor-text whitespace-pre-wrap text-sm text-muted-foreground">
                  {n.content || "—"}
                </p>
                {n.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {n.tags.map((t) => <span key={t} className="nova-chip">#{t}</span>)}
                  </div>
                )}
                <p className="mt-3 text-[10px] text-muted-foreground">{relativeTime(n.updatedAt)}</p>
              </>
            )}
          </div>
        ))}
        {notes.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Aún no hay notas.</p>}
      </div>
    </div>
  );
}
