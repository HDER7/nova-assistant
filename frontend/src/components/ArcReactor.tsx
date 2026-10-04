"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Rivas Industries crest — the official NOVA mark.
 * An original emblem in the spirit of the Wayne Industries crest: a cowl-shaped shield with
 * bat-ear points and a pointed base, the Rivas "R" cut out of it and two pillar slits.
 * The R and slits are real transparency (SVG mask), so the crest works on any background.
 *
 * tone: "red"  → red crest (default, for dark UI)
 *       "dark" → black crest (for red surfaces, like the brand plate)
 *       "light"→ off-white crest
 * Kept under the name ArcReactor so every existing brand slot picks it up.
 */
export function ArcReactor({
  size = 120,
  active = false,
  className,
  tone = "red",
}: {
  size?: number;
  active?: boolean;
  className?: string;
  tone?: "red" | "dark" | "light";
}) {
  const id = "crest" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const fill = tone === "dark" ? "#0a0a0a" : tone === "light" ? "hsl(var(--foreground))" : "hsl(var(--primary))";
  return (
    <svg
      viewBox="30 0 180 192"
      width={size}
      height={Math.round((size * 192) / 180)}
      role="img"
      aria-label="Rivas Industries"
      className={cn(active && "drop-shadow-[0_0_14px_hsl(var(--primary)/0.45)]", className)}
    >
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="-10" width="240" height="220">
          <rect x="0" y="-10" width="240" height="220" fill="white" />
          <g fill="black" transform="translate(55 10) scale(1.1)">
            <rect x="30" y="24" width="15" height="72" rx="2" />
            <path fillRule="evenodd" d="M45 24H63c16 0 25 9 25 24s-9 24-25 24H45Zm0 14v20h17c8 0 12-4 12-10s-4-10-12-10Z" />
            <path d="M52 60h12l22 36H74Z" />
          </g>
          <rect x="53" y="38" width="6" height="64" fill="black" />
          <rect x="181" y="38" width="6" height="64" fill="black" />
        </mask>
      </defs>
      <g mask={`url(#${id})`} fill={fill} className={cn(active && "animate-pulse")}>
        <path d="M40 22 H200 V104 Q200 126 176 130 Q140 136 120 188 Q100 136 64 130 Q40 126 40 104 Z" />
        <path d="M40 23 L40 2 L60 23 Z" />
        <path d="M200 23 L200 2 L180 23 Z" />
      </g>
    </svg>
  );
}

/** Alias for semantic clarity at new call sites. */
export const RivasMark = ArcReactor;

/**
 * Full brand lockup: crest + RIVAS wordmark + bar + INDUSTRIES, Wayne-Industries style.
 * tone "dark" = black on a red plate; "red" = red crest with off-white type on dark UI.
 */
export function RivasLockup({
  width = 320,
  tone = "red",
  className,
}: {
  width?: number;
  tone?: "red" | "dark";
  className?: string;
}) {
  const ink = tone === "dark" ? "#0a0a0a" : "hsl(var(--foreground))";
  return (
    <div className={cn("flex flex-col items-center", className)} style={{ width }}>
      <ArcReactor size={Math.round(width * 0.36)} tone={tone === "dark" ? "dark" : "red"} />
      <svg viewBox="0 0 640 150" width={width} height={Math.round((width * 150) / 640)} aria-hidden="true" className="mt-3">
        <text
          x="320"
          y="70"
          textAnchor="middle"
          fill={ink}
          fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
          fontWeight={900}
          fontSize="76"
          letterSpacing="10"
          transform="translate(-96 0) scale(1.3 1)"
        >
          RIVAS
        </text>
        <rect x="96" y="92" width="448" height="9" rx="4.5" fill={ink} />
        <text
          x="320"
          y="140"
          textAnchor="middle"
          fill={ink}
          fontFamily="'Helvetica Neue', Arial, sans-serif"
          fontSize="30"
          letterSpacing="17"
        >
          INDUSTRIES
        </text>
      </svg>
    </div>
  );
}
