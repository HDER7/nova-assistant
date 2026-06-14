"use client";

import { cn } from "@/lib/utils";

/** The signature NOVA core: layered rotating rings with a pulsing center. */
export function ArcReactor({
  size = 160,
  active = false,
  className,
}: {
  size?: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
      <div className="absolute inset-0 rounded-full border border-primary/30 animate-spin-slow" />
      <div className="absolute inset-[10%] rounded-full border border-dashed border-primary/40 animate-spin-reverse" />
      <div className="absolute inset-[22%] rounded-full border-2 border-primary/50 animate-spin-slow" />
      <div className="absolute inset-[34%] rounded-full border border-accent/40 animate-spin-reverse" />
      <div
        className={cn(
          "absolute inset-[40%] rounded-full bg-primary shadow-glow-lg transition-all",
          active ? "animate-pulse scale-110" : "opacity-80"
        )}
      />
      {active && (
        <>
          <span className="absolute inset-[36%] rounded-full bg-primary/40 animate-pulse-ring" />
          <span className="absolute inset-[36%] rounded-full bg-primary/30 animate-pulse-ring [animation-delay:0.8s]" />
        </>
      )}
    </div>
  );
}
