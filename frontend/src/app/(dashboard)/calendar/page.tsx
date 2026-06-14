"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, MapPin, CalendarDays, BellRing, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import type { CalendarEvent, Reminder } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const COLORS = ["cyan", "violet", "emerald", "amber", "rose"];
const COLOR_CLASS: Record<string, string> = {
  cyan: "bg-cyan-400", violet: "bg-violet-400", emerald: "bg-emerald-400",
  amber: "bg-amber-400", rose: "bg-rose-400",
};

export default function CalendarPage() {
  const pushToast = useUIStore((s) => s.pushToast);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [ev, setEv] = useState({ title: "", startAt: "", endAt: "", location: "", color: "cyan" });
  const [rem, setRem] = useState({ title: "", remindAt: "", recurrence: "NONE" });
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const [e, r] = await Promise.all([
        api.get<CalendarEvent[]>("/api/calendar/events"),
        api.get<Reminder[]>("/api/reminders"),
      ]);
      setEvents(e);
      setReminders(r);
    } catch {
      /* silent */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!ev.title || !ev.startAt || !ev.endAt) return;
    setLoading(true);
    try {
      await api.post("/api/calendar/events", {
        title: ev.title,
        location: ev.location,
        color: ev.color,
        startAt: new Date(ev.startAt).toISOString(),
        endAt: new Date(ev.endAt).toISOString(),
      });
      setEv({ title: "", startAt: "", endAt: "", location: "", color: "cyan" });
      load();
      pushToast({ title: "Evento creado", variant: "success" });
    } catch {
      pushToast({ title: "No se pudo crear el evento", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function createReminder(e: React.FormEvent) {
    e.preventDefault();
    if (!rem.title || !rem.remindAt) return;
    try {
      await api.post("/api/reminders", {
        title: rem.title,
        remindAt: new Date(rem.remindAt).toISOString(),
        recurrence: rem.recurrence,
      });
      setRem({ title: "", remindAt: "", recurrence: "NONE" });
      load();
      pushToast({ title: "Recordatorio creado", variant: "success" });
    } catch {
      pushToast({ title: "Error al crear recordatorio", variant: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Calendario</h1>
        <p className="text-sm text-muted-foreground">Tu agenda y recordatorios en un solo lugar.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Events */}
        <div className="space-y-4">
          <form onSubmit={createEvent} className="nova-card space-y-3">
            <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-4 w-4 text-primary" /> Nuevo evento</h2>
            <input value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} className="nova-input" placeholder="Título del evento" />
            <div className="grid grid-cols-2 gap-2">
              <input type="datetime-local" value={ev.startAt} onChange={(e) => setEv({ ...ev, startAt: e.target.value })} className="nova-input" />
              <input type="datetime-local" value={ev.endAt} onChange={(e) => setEv({ ...ev, endAt: e.target.value })} className="nova-input" />
            </div>
            <input value={ev.location} onChange={(e) => setEv({ ...ev, location: e.target.value })} className="nova-input" placeholder="Ubicación (opcional)" />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button type="button" key={c} onClick={() => setEv({ ...ev, color: c })}
                    className={cn("h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-background", COLOR_CLASS[c], ev.color === c ? "ring-primary" : "ring-transparent")} />
                ))}
              </div>
              <button type="submit" disabled={loading} className="nova-btn-primary">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear
              </button>
            </div>
          </form>

          <div className="nova-card">
            <h3 className="mb-3 font-semibold">Agenda</h3>
            <div className="space-y-2">
              {events.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin eventos</p>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                    <span className={cn("h-8 w-1 rounded-full", COLOR_CLASS[e.color] || "bg-cyan-400")} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.startAt, { dateStyle: "medium", timeStyle: "short" })}
                        {e.location && <span className="ml-2 inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                      </p>
                    </div>
                    <button onClick={() => { api.del(`/api/calendar/events/${e.id}`).then(load); }} className="text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Reminders */}
        <div className="space-y-4">
          <form onSubmit={createReminder} className="nova-card space-y-3">
            <h2 className="flex items-center gap-2 font-semibold"><BellRing className="h-4 w-4 text-primary" /> Nuevo recordatorio</h2>
            <input value={rem.title} onChange={(e) => setRem({ ...rem, title: e.target.value })} className="nova-input" placeholder="Recuérdame…" />
            <div className="grid grid-cols-2 gap-2">
              <input type="datetime-local" value={rem.remindAt} onChange={(e) => setRem({ ...rem, remindAt: e.target.value })} className="nova-input" />
              <select value={rem.recurrence} onChange={(e) => setRem({ ...rem, recurrence: e.target.value })} className="nova-input">
                <option value="NONE">Una vez</option>
                <option value="DAILY">Cada día</option>
                <option value="WEEKLY">Cada semana</option>
                <option value="MONTHLY">Cada mes</option>
              </select>
            </div>
            <button type="submit" className="nova-btn-primary w-full"><Plus className="h-4 w-4" /> Crear recordatorio</button>
          </form>

          <div className="nova-card">
            <h3 className="mb-3 font-semibold">Recordatorios</h3>
            <div className="space-y-2">
              {reminders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin recordatorios</p>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                    <button
                      onClick={() => { api.patch(`/api/reminders/${r.id}`, { completed: !r.completed }).then(load); }}
                      className={cn("flex h-5 w-5 items-center justify-center rounded-md border", r.completed ? "border-success bg-success/20 text-success" : "border-border")}
                    >
                      {r.completed && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <div className="flex-1">
                      <p className={cn("text-sm font-medium", r.completed && "text-muted-foreground line-through")}>{r.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.remindAt, { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                    <button onClick={() => { api.del(`/api/reminders/${r.id}`).then(load); }} className="text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
