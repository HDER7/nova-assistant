"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Flag, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import type { Task } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "TODO", label: "Por hacer" },
  { key: "IN_PROGRESS", label: "En progreso" },
  { key: "DONE", label: "Completadas" },
];
const NEXT: Record<Task["status"], Task["status"]> = { TODO: "IN_PROGRESS", IN_PROGRESS: "DONE", DONE: "TODO" };
const PRIORITY: Record<Task["priority"], string> = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-primary",
  HIGH: "text-warning",
  URGENT: "text-danger",
};

export default function TasksPage() {
  const pushToast = useUIStore((s) => s.pushToast);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("MEDIUM");
  const [due, setDue] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setTasks(await api.get<Task[]>("/api/tasks"));
    } catch {
      /* silent */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      await api.post("/api/tasks", {
        title,
        priority,
        dueAt: due ? new Date(due).toISOString() : null,
      });
      setTitle("");
      setDue("");
      setPriority("MEDIUM");
      load();
      pushToast({ title: "Tarea creada", variant: "success" });
    } catch {
      pushToast({ title: "No se pudo crear la tarea", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function move(t: Task) {
    try {
      await api.patch(`/api/tasks/${t.id}`, { status: NEXT[t.status] });
      load();
    } catch {
      /* silent */
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/api/tasks/${id}`);
      load();
    } catch {
      /* silent */
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Tareas</h1>
        <p className="text-sm text-muted-foreground">Organiza tu trabajo en un tablero de control.</p>
      </header>

      <form onSubmit={create} className="nova-card flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs text-muted-foreground">Nueva tarea</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="nova-input" placeholder="¿Qué hay que hacer?" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Prioridad</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])} className="nova-input">
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Vence</label>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="nova-input" />
        </div>
        <button type="submit" disabled={loading} className="nova-btn-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="rounded-2xl border border-border bg-surface/40 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="nova-chip">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((t) => (
                  <div key={t.id} className="group rounded-xl border border-border/60 bg-background/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm font-medium", t.status === "DONE" && "text-muted-foreground line-through")}>
                        {t.title}
                      </p>
                      <button onClick={() => remove(t.id)} className="text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={cn("flex items-center gap-1 text-xs", PRIORITY[t.priority])}>
                        <Flag className="h-3 w-3" /> {t.priority}
                      </span>
                      {t.dueAt && <span className="text-[10px] text-muted-foreground">{formatDate(t.dueAt, { dateStyle: "short" })}</span>}
                    </div>
                    <button onClick={() => move(t)} className="mt-2 flex items-center gap-1 text-[11px] text-primary hover:underline">
                      Mover a {COLUMNS.find((c) => c.key === NEXT[t.status])?.label} <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Vacío</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
