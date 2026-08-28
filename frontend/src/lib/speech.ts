"use client";

/* Lightweight wrappers around the Web Speech API (STT + TTS). */

type AnyWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as AnyWindow;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createRecognition(lang = "es-ES"): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as AnyWindow;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  return recognition;
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Warm up the voice list (Chrome loads it asynchronously). Call once on mount. */
export function preloadVoices(): void {
  if (!ttsSupported()) return;
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", () => {
      window.speechSynthesis.getVoices();
    });
  } catch {
    /* ignore */
  }
}

export function speak(text: string, lang = "es-ES", onEnd?: () => void): void {
  if (!ttsSupported() || !text) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1.02;
  utterance.pitch = 1.0;
  const base = lang.slice(0, 2);
  const voices = synth.getVoices();
  const preferred =
    voices.find((v) => v.lang.startsWith(base) && /google|microsoft|nova|helena|sabina|female/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith(base));
  if (preferred) utterance.voice = preferred;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  synth.speak(utterance);
  // Chrome occasionally parks the queue; nudge it back to playing.
  window.setTimeout(() => {
    try {
      if (synth.paused) synth.resume();
    } catch {
      /* ignore */
    }
  }, 250);
}

export function cancelSpeech(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
