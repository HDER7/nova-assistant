"use client";

import { useEffect, useRef } from "react";

/**
 * Live microphone waveform — the Iron Man HUD cue while NOVA is listening.
 * Opens its own analyser on the mic and draws frequency bars in the accent color.
 */
export function VoiceWave({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AC();
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const g = canvas.getContext("2d");
        if (!g) return;
        const color = getComputedStyle(canvas).color || "#E10600";

        const draw = () => {
          rafRef.current = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(data);
          const w = canvas.width;
          const h = canvas.height;
          g.clearRect(0, 0, w, h);
          const n = data.length;
          const bw = w / n;
          g.fillStyle = color;
          for (let i = 0; i < n; i++) {
            const v = data[i] / 255;
            const bh = Math.max(2, v * h);
            g.fillRect(i * bw + 1, (h - bh) / 2, bw - 2, bh);
          }
        };
        draw();
      } catch {
        /* mic unavailable — silently skip the visualizer */
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      try {
        void audioCtx?.close();
      } catch {
        /* ignore */
      }
    };
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} width={220} height={38} className="text-primary" style={{ width: 220, height: 38 }} />;
}
