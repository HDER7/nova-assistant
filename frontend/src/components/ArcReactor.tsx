"use client";

import { cn } from "@/lib/utils";

/**
 * Official NOVA / Rivas mark — Concept C (minimal Yeezy).
 * A stark geometric "R" for Rivas with a single red accent bar.
 * Kept under the name ArcReactor so every brand slot uses the new logo.
 */
export function ArcReactor({
  size = 120,
  active = false,
  className,
}: {
  size?: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="9 16 88 88"
      width={size}
      height={size}
      role="img"
      aria-label="Rivas"
      className={cn("text-foreground", className)}
    >
      <rect
        x="14"
        y="26"
        width="6"
        height="68"
        fill="hsl(var(--primary))"
        className={cn(active && "animate-pulse")}
      />
      <g fill="currentColor" transform="translate(12 4) scale(0.92)">
        <rect x="30" y="24" width="15" height="72" rx="2" />
        <path
          fillRule="evenodd"
          d="M45 24H63c16 0 25 9 25 24s-9 24-25 24H45Zm0 14v20h17c8 0 12-4 12-10s-4-10-12-10Z"
        />
        <path d="M52 60h12l22 36H74Z" />
      </g>
    </svg>
  );
}

/** Alias for semantic clarity at new call sites. */
export const RivasMark = ArcReactor;
