"use client";

import { SentenceSpeaker, cancelAll, onSpeakingChange, warmUpVoices } from "./tts";

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
  warmUpVoices();
}

/**
 * Speak a whole text (interrupting anything in progress), sentence by sentence with the
 * personality's voice. onEnd fires when NOVA finishes talking (or immediately if TTS is unavailable).
 */
export function speak(text: string, lang = "es-ES", onEnd?: () => void, persona = "JARVIS"): void {
  if (!ttsSupported() || !text) {
    onEnd?.();
    return;
  }
  cancelAll();
  if (onEnd) {
    const off = onSpeakingChange((speaking) => {
      if (!speaking) {
        off();
        onEnd();
      }
    });
  }
  const s = new SentenceSpeaker({ lang, persona });
  s.push(text);
  s.flush();
}

export function cancelSpeech(): void {
  cancelAll();
}
