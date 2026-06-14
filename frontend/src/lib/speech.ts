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

export function speak(text: string, lang = "es-ES"): void {
  if (!ttsSupported() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1.02;
  utterance.pitch = 1.0;
  const voices = synth.getVoices();
  const preferred =
    voices.find((v) => v.lang.startsWith("es") && /google|microsoft|nova|female/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith("es"));
  if (preferred) utterance.voice = preferred;
  synth.speak(utterance);
}

export function cancelSpeech(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
