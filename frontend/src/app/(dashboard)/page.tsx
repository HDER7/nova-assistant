"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckSquare, StickyNote, BellRing, CalendarDays, MessageSquare,
  BrainCircuit, ArrowRight, Sparkles, Volume2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { StatCard } from "@/components/StatCard";
import { Donut, Bars } from "@/components/Donut";
import { ArcReactor } from "@/components/ArcReactor";
import { speak, ttsSupported } from "@/lib/speech";
import { soundMuted } from "@/lib/sound";
import type { DashboardSummary, Task, CalendarEvent } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const lang = user?.locale === "en" ? "en-US" : "es-ES";
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    api.get<DashboardSummary>("/api/dashboard/summary").then(setSummary).catch(() => {});
    api.get<Task[]>("/api/tasks?status=TODO").then((t) => setTasks(t.slice(0, 5))).catch(() => {});
    api.get<CalendarEvent[]>("/api/calendar/events").then((e) => setEvents(e.slice(0, 5))).catch(() => {});
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 6 ? "Buenas noches" : hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  const surname = useMemo(() => {
    const n = (user?.displayName || "").trim();
    if (!n) return "";
    const parts = n.split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  }, [user?.displayName]);

  const briefing = useMemo(() => {
    if (!summary) return "";
    const todo = summary.tasks.todo ?? 0;
    const rem = summary.remindersPending ?? 0;
    const ev = summary.upcomingEvents ?? 0;
    const who = surname ? `, Señor ${surname}` : "";
    const parts: string[] = [];
    if (todo) parts.push(`${todo} ${todo === 1 ? "tarea pendiente" : "tareas pendientes"}`);
    if (rem) parts.push(`${rem} ${rem === 1 ? "recordatorio" : "recordatorios"}`);
    if (ev) parts.push(`${ev} ${ev === 1 ? "evento próximo" : "eventos próximos"}`);
    const status = parts.length
      ? `Tiene ${parts.length > 1 ? parts.slice(0, -1).join(", ") + " y " + parts[parts.length - 1] : parts[0]}.`
      : "No hay nada urgente en su agenda.";
    const close = parts.length ? "Cuando quiera, empezamos." : "Todo bajo control.";
    return `${greeting}${who}. ${status} ${close}`;
  }, [summary, surname, greeting]);

  useEffect(() => {
    if (!briefing) return;
    let done = false;
    try { done = sessionStorage.getItem("nova.briefed") === "1"; } catch { /* ignore */ }
    if (done) return;
    try { sessionStorage.setItem("nova.briefed", "1"); } catch { /* ignore */ }
    if (ttsSupported() && !soundMuted()) {
      const t = window.setTimeout(() => speak(briefing, lang), 2400);
      return () => clearTimeout(t);
    }
  }, [briefing, lang]);

  return (
    <div className="space-y-6">
      <section className="nova-card relative flex flex-col items-start justify-between gap-6 overflow-hidden md:flex-row md:items-center">
        <div className="relative z-10">
          <p className="nova-label">NOVA · en línea</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {greeting}{surname ? `, Señor ${surname}` : ""}
          </h1>
          <div className="mt-2 flex max-w-md items-start gap-2">
            <p className="text-sm text-muted-foreground">
              {briefing || "NOVA está operativa y monitorizando tu centro de control."}
            </p>
            {briefing && ttsSupported() && (
              <button
                onClick={() => speak(briefing, lang)}
                title="Reproducir informe"
                className="mt-0.5 shrink-0 text-muted-foreground transition hover:text-primary"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/chat" className="nova-btn-primary">
              <MessageSquare className="h-4 w-4" /> Hablar con NOVA
            </Link>
            <Link href="/tasks" className="nova-btn-ghost">
              <CheckSquare className="h-4 w-4" /> Nueva tarea
            </Link>
          </div>
        </div>
        <ArcReactor size={150} active className="shrink-0 self-center" />
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tareas pendientes" value={summary?.tasks.todo ?? 0} icon={CheckSquare} href="/tasks" />
        <StatCard label="Recordatorios" value={summary?.remindersPending ?? 0} icon={BellRing} href="/calendar" />
        <StatCard label="Eventos próximos" value={summary?.upcomingEvents ?? 0} icon={CalendarDays} href="/calendar" />
        <StatCard label="Notas" value={summary?.notes ?? 0} icon={StickyNote} href="/notes" />
        <StatCard label="Conversaciones" value={summary?.conversations ?? 0} icon={MessageSquare} href="/chat" />
        <StatCard label="Memorias" value={summary?.memories ?? 0} icon={BrainCircuit} href="/memory" />
        <StatCard label="Tareas completadas" value={summary?.tasks.done ?? 0} icon={CheckSquare} />
        <StatCard label="En progreso" value={summary?.tasks.inProgress ?? 0} icon={Sparkles} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="nova-card">
          <h2 className="mb-4 font-semibold">Distribución de tareas</h2>
          <Donut
            centerLabel="tareas"
            data={[
              { label: "Por hacer", value: summary?.tasks.todo ?? 0, color: "hsl(var(--primary))" },
              { label: "En progreso", value: summary?.tasks.inProgress ?? 0, color: "hsl(var(--warning))" },
              { label: "Completadas", value: summary?.tasks.done ?? 0, color: "hsl(var(--success))" },
            ]}
          />
        </div>
        <div className="nova-card">
          <h2 className="mb-4 font-semibold">Tu actividad</h2>
          <Bars
            data={[
              { label: "Conversaciones", value: summary?.conversations ?? 0, color: "hsl(var(--primary))" },
              { label: "Notas", value: summary?.notes ?? 0, color: "hsl(var(--accent))" },
              { label: "Memorias", value: summary?.memories ?? 0, color: "hsl(var(--success))" },
              { label: "Recordatorios", value: summary?.remindersPending ?? 0, color: "hsl(var(--warning))" },
              { label: "Eventos", value: summary?.upcomingEvents ?? 0, color: "hsl(var(--danger))" },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="nova-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Tareas por hacer</h2>
            <Link href="/tasks" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin tareas pendientes 🎉</p>
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="flex-1 text-sm">{t.title}</span>
                  {t.dueAt && <span className="text-xs text-muted-foreground">{formatDate(t.dueAt, { dateStyle: "short" })}</span>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="nova-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Próximos eventos</h2>
            <Link href="/calendar" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Calendario <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nada en la agenda</p>
            ) : (
              events.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="flex-1 text-sm">{e.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(e.startAt, { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
