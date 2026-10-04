"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { onSpeechPulse } from "@/lib/tts";
import { ArcReactor } from "@/components/ArcReactor";
import type { VoicePhase } from "@/lib/useVoiceLoop";

/**
 * The HUD centrepiece: the Rivas "R" inside tactical rings.
 * - Reacts to the microphone level while you talk (levelRef from useVoiceLoop).
 * - Pulses on every word NOVA speaks (speech boundary events).
 * Animation runs on requestAnimationFrame and mutates SVG attributes directly — no React re-renders.
 */
export function HudCore({
  size = 300,
  levelRef,
  phase,
}: {
  size?: number;
  levelRef?: MutableRefObject<number>;
  phase: VoicePhase | "speaking" | "thinking";
}) {
  const glowRef = useRef<SVGCircleElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const barsRef = useRef<SVGGElement>(null);
  const pulse = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => onSpeechPulse(() => (pulse.current = 1)), []);

  useEffect(() => {
    let raf = 0;
    let t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      t += 0.016;
      const p = phaseRef.current;
      pulse.current *= 0.9;
      const mic = levelRef?.current ?? 0;
      const idle = 0.04 + 0.03 * Math.sin(t * 1.6);
      const thinking = p === "thinking" || p === "transcribing" ? 0.12 + 0.08 * Math.sin(t * 6) : 0;
      const energy = Math.min(
        1,
        Math.max(idle, thinking, p === "speaking" ? 0.18 + pulse.current * 0.6 : 0, p === "recording" || p === "listening" ? mic : 0)
      );
      if (glowRef.current) {
        glowRef.current.setAttribute("r", String(70 + energy * 34));
        glowRef.current.setAttribute("opacity", String(0.18 + energy * 0.5));
      }
      if (ringRef.current) {
        ringRef.current.setAttribute("r", String(118 + energy * 10));
        ringRef.current.setAttribute("stroke-opacity", String(0.35 + energy * 0.6));
      }
      if (barsRef.current) {
        const bars = barsRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          const wobble = 0.5 + 0.5 * Math.sin(t * 3 + i * 0.7);
          const h = 5 + energy * 24 * wobble;
          (bars[i] as SVGRectElement).setAttribute("height", String(h));
          (bars[i] as SVGRectElement).setAttribute("y", String(-148 - h));
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  const ticks = Array.from({ length: 60 });
  const bars = Array.from({ length: 36 });

  return (
    <svg width={size} height={size} viewBox="-185 -185 370 370" role="img" aria-label="Núcleo NOVA">
      <defs>
        <radialGradient id="hudGlow">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle ref={glowRef} r="70" fill="url(#hudGlow)" opacity="0.2" />

      {/* audio bars around the core */}
      <g ref={barsRef}>
        {bars.map((_, i) => (
          <rect
            key={i}
            x="-1.5"
            y="-156"
            width="3"
            height="6"
            fill="hsl(var(--primary))"
            opacity="0.8"
            transform={`rotate(${(360 / bars.length) * i})`}
          />
        ))}
      </g>

      {/* tick ring */}
      <g className="hud-ring-spin" opacity="0.55">
        {ticks.map((_, i) => (
          <line
            key={i}
            x1="0"
            y1={i % 5 === 0 ? -140 : -136}
            x2="0"
            y2="-131"
            stroke="hsl(var(--foreground))"
            strokeOpacity={i % 5 === 0 ? 0.6 : 0.25}
            strokeWidth="1"
            transform={`rotate(${i * 6})`}
          />
        ))}
      </g>

      {/* segmented arc ring */}
      <g className="hud-ring-spin-rev">
        <circle r="104" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="60 18 8 18" />
      </g>
      <circle ref={ringRef} r="118" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.4" strokeWidth="1" />
      <circle r="86" fill="hsl(var(--background))" fillOpacity="0.55" stroke="hsl(var(--border))" />

      {/* Rivas Industries crest */}
      <g transform="translate(-52 -58)">
        <ArcReactor size={104} />
      </g>
    </svg>
  );
}
