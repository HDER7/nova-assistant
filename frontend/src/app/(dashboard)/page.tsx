"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckSquare, StickyNote, BellRing, CalendarDays, MessageSquare,
  BrainCircuit, ArrowRight, Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { StatCard } from "@/components/StatCard";
import { ArcReactor } from "@/components/ArcReactor";
import type { DashboardSummary, Task, CalendarEvent } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
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

  return (
    <div className="space-y-6">
      <section className="nova-card relative flex flex-col items-start justify-between gap-6 overflow-hidden md:flex-row md:items-center">
        <div className="relative z-10">
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{user?.displayName || "Comandante"}</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            NOVA está operativa y monitorizando tu centro de control. ¿En qué trabajamos hoy?
          </p>
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
