"use client";

import { Loader2, ShieldAlert, ShieldCheck, ShieldX, CheckCircle2, AlertTriangle } from "lucide-react";
import type { ToolCard } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<ToolCard["status"], string> = {
  running: "text-muted-foreground border-border",
  ok: "text-success border-success/40",
  warn: "text-warning border-warning/50",
  danger: "text-primary border-primary/60",
  error: "text-danger border-danger/50",
};

function StatusIcon({ card, className }: { card: ToolCard; className?: string }) {
  if (card.status === "running") return <Loader2 className={cn("animate-spin", className)} />;
  if (card.status === "danger") return <ShieldX className={className} />;
  if (card.status === "warn") return <ShieldAlert className={className} />;
  if (card.status === "error") return <AlertTriangle className={className} />;
  if (card.tool === "virustotal_lookup" || card.tool === "cve_lookup") return <ShieldCheck className={className} />;
  return <CheckCircle2 className={className} />;
}

/** Compact chip shown inside chat bubbles. */
export function ToolChip({ card }: { card: ToolCard }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-sm border bg-background/40 px-2 py-0.5 text-[11px]",
        STATUS_COLOR[card.status]
      )}
      title={card.text || card.subtitle}
    >
      <StatusIcon card={card} className="h-3 w-3 shrink-0" />
      <span className="font-medium uppercase tracking-[0.1em]">{card.title}</span>
      {card.subtitle && <span className="truncate text-muted-foreground">· {card.subtitle}</span>}
    </span>
  );
}

/** Radial gauge (0..1) drawn as an SVG arc. */
function Gauge({ value, status }: { value: number; status: ToolCard["status"] }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color =
    status === "danger" ? "hsl(var(--primary))" : status === "warn" ? "hsl(var(--warning))" : "hsl(var(--success))";
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${c * v} ${c}`}
        transform="rotate(-90 32 32)"
        style={{ transition: "stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1)" }}
      />
      <text x="32" y="36" textAnchor="middle" className="fill-foreground" style={{ fontSize: 12, fontWeight: 600 }}>
        {Math.round(v * 100)}%
      </text>
    </svg>
  );
}

/** Holographic panel for the HUD. */
export function HoloCard({ card }: { card: ToolCard }) {
  return (
    <div
      className={cn(
        "holo-card relative w-72 overflow-hidden rounded-md border bg-surface/70 p-3 backdrop-blur-md",
        STATUS_COLOR[card.status]
      )}
    >
      <span className="holo-scan pointer-events-none absolute inset-x-0 top-0 h-8" />
      <div className="flex items-start gap-3">
        {typeof card.gauge === "number" ? (
          <Gauge value={card.gauge} status={card.status} />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-current">
            <StatusIcon card={card} className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="nova-label !text-current">{card.title}</p>
          {card.subtitle && <p className="mt-0.5 truncate font-mono text-xs text-foreground">{card.subtitle}</p>}
          {card.status === "running" && <p className="mt-1 text-xs text-muted-foreground">Analizando…</p>}
          {card.metrics && card.metrics.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1">
              {card.metrics.map((m) => (
                <div key={m.label} className="rounded-sm bg-background/50 px-1.5 py-1 text-center">
                  <p className="font-mono text-sm text-foreground">{m.value}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          )}
          {!card.metrics && card.phase === "done" && card.text && (
            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{card.text}</p>
          )}
        </div>
      </div>
    </div>
  );
}
