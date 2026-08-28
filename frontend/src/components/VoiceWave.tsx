"use client";

import { useEffect, useRef } from "react";

/**
 * Live microphone waveform — the Iron Man HUD cue while NOVA is listening.
 * If given an existing AnalyserNode it draws from that (shared mic stream);
 * otherwise it opens its own stream. Works in any browser with Web Audio.
 */
export function VoiceWave({ active, analyser }: { active: boolean; analyser?: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let ownStream: MediaStream | null = null;
    let ownCtx: AudioContext | null = null;

    const run = (an: AnalyserNode) => {
      const data = new Uint8Array(an.frequencyBinCount);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const g = canvas.getContext("2d");
      if (!g) return;
      const color = getComputedStyle(canvas).color || "#E10600";
      const draw = () => {
        rafRef.current = requestAnimationFrame(draw);
        an.getByteFrequencyData(data);
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
    };

    if (analyser) {
      run(analyser);
    } else {
      (async () => {
        try {
          ownStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (stopped) {
            ownStream.getTracks().forEach((t) => t.stop());
            return;
          }
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          ownCtx = new AC();
          const src = ownCtx.createMediaStreamSource(ownStream);
          const an = ownCtx.createAnalyser();
          an.fftSize = 64;
          src.connect(an);
          run(an);
        } catch {
          /* mic unavailable — skip visualizer */
        }
      })();
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
      ownStream?.getTracks().forEach((t) => t.stop());
      try {
        void ownCtx?.close();
      } catch {
        /* ignore */
      }
    };
  }, [active, analyser]);

  if (!active) return null;
  return <canvas ref={canvasRef} width={220} height={38} className="text-primary" style={{ width: 220, height: 38 }} />;
}
