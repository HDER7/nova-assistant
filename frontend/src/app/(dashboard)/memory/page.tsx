"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, BrainCircuit, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import type { MemoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  FACT: "Hecho", PREFERENCE: "Preferencia", EVENT: "Evento", GOAL: "Objetivo",
};

export default function MemoryPage() {
  const pushToast = useUIStore((s) => s.pushToast);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("FACT");
  const [importance, setImportance] = useState(3);

  async function load() {
    try {
      setItems(await api.get<MemoryItem[]>("/api/memory"));
    } catch {
      /* silent */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await api.post("/api/memory", { content, kind, importance });
      setContent("");
      setKind("FACT");
      setImportance(3);
      load();
      pushToast({ title: "Memoria guardada", variant: "success" });
    } catch {
      pushToast({ title: "No se pudo guardar", variant: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BrainCircuit className="h-6 w-6 text-primary" /> Memoria
        </h1>
        <p className="text-sm text-muted-foreground">
          Lo que NOVA recuerda sobre ti. Se usa para personalizar cada respuesta.
        </p>
      </header>

      <form onSubmit={create} className="nova-card space-y-3">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} className="nova-input resize-none" placeholder="Algo que NOVA debería recordar…" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs text-muted-foreground">Tipo</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="nova-input">
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Importancia: {importance}</label>
            <input type="range" min={1} max={5} value={importance} onChange={(e) => setImportance(Number(e.target.value))} className="h-2 w-40 accent-[hsl(var(--primary))]" />
          </div>
          <button type="submit" className="nova-btn-primary"><Plus className="h-4 w-4" /> Recordar</button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((m) => (
          <div key={m.id} className="group nova-card flex items-start justify-between gap-3">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="nova-chip">{KIND_LABEL[m.kind] || m.kind}</span>
                <span className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("h-3 w-3", i < m.importance ? "fill-primary text-primary" : "text-muted-foreground/30")} />
                  ))}
                </span>
              </div>
              <p className="text-sm">{m.content}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">origen: {m.source}</p>
            </div>
            <button onClick={() => { api.del(`/api/memory/${m.id}`).then(load); }} className="text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">NOVA aún no recuerda nada. Cuéntale algo.</p>}
      </div>
    </div>
  );
}
