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
    <div className="nova-card group relative overflow-hidden transition hover:border-primary/40">
      <div className="flex items-start justify-between">
        <div>
          <p className="nova-label">{label}</p>
          <p className="mt-3 font-mono text-3xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
