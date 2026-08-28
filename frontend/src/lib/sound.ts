"use client";

/* Synthesized UI sounds via the Web Audio API — no asset files.
   JARVIS-style boot chime, confirm blips and listen cues. Muted state in localStorage. */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function soundMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem("nova.sound") === "off";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem("nova.sound", muted ? "off" : "on");
  } catch {
    /* ignore */
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.05, type: OscillatorType = "sine"): void {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Boot / "systems online" — a rising three-note chord. */
export function playOnline(): void {
  if (soundMuted()) return;
  tone(523.25, 0, 0.18, 0.05, "sine");
  tone(783.99, 0.09, 0.22, 0.045, "sine");
  tone(1046.5, 0.19, 0.32, 0.04, "triangle");
}

/** Short high blip — message sent. */
export function playBlip(): void {
  if (soundMuted()) return;
  tone(880, 0, 0.06, 0.03, "triangle");
}

/** Two-note confirmation — action done. */
export function playConfirm(): void {
  if (soundMuted()) return;
  tone(659.25, 0, 0.1, 0.035, "sine");
  tone(987.77, 0.07, 0.14, 0.03, "sine");
}

/** Soft cue — now listening. */
export function playListen(): void {
  if (soundMuted()) return;
  tone(1174.66, 0, 0.08, 0.03, "sine");
}
