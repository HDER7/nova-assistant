"use client";

import { useEffect, useState } from "react";
import { ArcReactor } from "@/components/ArcReactor";
import { playOnline } from "@/lib/sound";
import { cn } from "@/lib/utils";

const LINES = [
  "Núcleo neuronal",
  "Memoria persistente",
  "Motores de inferencia",
  "Módulo SOC",
  "Sistemas en línea",
];

/** One-time-per-session JARVIS boot overlay. Plays the "online" chime. */
export function BootSequence() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let already = false;
    try {
      already = sessionStorage.getItem("nova.booted") === "1";
    } catch {
      /* ignore */
    }
    if (already) return;
    try {
      sessionStorage.setItem("nova.booted", "1");
    } catch {
      /* ignore */
    }
    setShow(true);
    playOnline();
    const timers: number[] = [];
    LINES.forEach((_, i) => timers.push(window.setTimeout(() => setStep(i + 1), 190 * (i + 1))));
    timers.push(window.setTimeout(() => setShow(false), 190 * LINES.length + 750));
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background">
      <ArcReactor size={120} active />
      <p className="nova-label">Inicializando NOVA</p>
      <div className="w-64 space-y-1.5">
        {LINES.map((l, i) => (
          <div
            key={l}
            className={cn(
              "flex items-center justify-between text-xs transition-colors",
              i < step ? "text-foreground" : "text-muted-foreground/40"
            )}
          >
            <span className="uppercase tracking-[0.14em]">{l}</span>
            <span className={i < step ? "text-primary" : "opacity-30"}>{i < step ? "OK" : "···"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
