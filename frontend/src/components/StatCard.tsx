"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="nova-card group relative overflow-hidden transition hover:glow-border">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 font-mono text-3xl font-semibold glow-text">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-8 -right-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/20" />
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
