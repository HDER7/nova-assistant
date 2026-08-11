"use client";

import { cn } from "@/lib/utils";

/**
 * NOVA core mark — Batman × Yeezy.
 * A stark red square lockup: a thin bracket ring, a solid red core, and a
 * single slow sweep when active. Flat, tactical, no glow.
 */
export function ArcReactor({
  size = 160,
  active = false,
  className,
}: {
  size?: number;
  active?: boolean;
  className?: string;
}) {
  const core = Math.round(size * 0.26);
  return (
    <div
      className={cn("relative", className)}
      style={{ width: size, height: size }}
    >
      {/* Outer bracket ring */}
      <div className="absolute inset-0 rounded-md border border-border" />
      {/* Rotating hairline ring — single, slow, subtle */}
      <div className="absolute inset-[14%] rounded-full border border-primary/25 animate-spin-slow" />
      {/* Inner square frame */}
      <div className="absolute inset-[28%] rounded-sm border border-border" />
      {/* Solid red core */}
      <div
        className={cn(
          "absolute rounded-sm bg-primary transition-transform duration-500",
          active ? "scale-110" : "scale-100"
        )}
        style={{
          width: core,
          height: core,
          left: `calc(50% - ${core / 2}px)`,
          top: `calc(50% - ${core / 2}px)`,
        }}
      />
      {active && (
        <span className="absolute inset-[28%] rounded-sm border border-primary/50 animate-pulse-ring" />
      )}
    </div>
  );
}
