"use client";

import { useUIStore } from "@/store/uiStore";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useUIStore();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto animate-fade-up glass flex items-start gap-3 rounded-xl border p-3.5 shadow-glow",
            t.variant === "success" && "border-success/50",
            t.variant === "error" && "border-danger/50"
          )}
        >
          <span className="mt-0.5">
            {t.variant === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : t.variant === "error" ? (
              <XCircle className="h-5 w-5 text-danger" />
            ) : (
              <Info className="h-5 w-5 text-primary" />
            )}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{t.title}</p>
            {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
