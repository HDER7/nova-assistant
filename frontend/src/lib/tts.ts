"use client";

/*
 * NOVA voice output.
 * - Speaks sentence by sentence while the answer is still streaming (no awkward silence).
 * - Picks the best neural voice available (Edge "Natural"/"Online" voices, Google voices)
 *   matching the active personality, unless the user chose one in Settings.
 * - Exposes "speaking" state + word-boundary pulses so the HUD core can react to NOVA's voice.
 */

type SpeakingListener = (speaking: boolean) => void;
type PulseListener = () => void;

let pending = 0;
let generation = 0; // bumps on cancel so stale utterance callbacks are ignored
const speakingListeners = new Set<SpeakingListener>();
const pulseListeners = new Set<PulseListener>();

export function ttsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function setPending(n: number) {
  const was = pending > 0;
  pending = Math.max(0, n);
  const is = pending > 0;
  if (was !== is) speakingListeners.forEach((l) => l(is));
}

export function isSpeaking(): boolean {
  return pending > 0;
}

export function onSpeakingChange(cb: SpeakingListener): () => void {
  speakingListeners.add(cb);
  return () => speakingListeners.delete(cb);
}

/** Lets other audio sources (e.g. Gemini Live playback) pulse the HUD core. */
export function emitSpeechPulse() {
  pulseListeners.forEach((l) => l());
}

/** Fires on every spoken word (when the browser reports boundaries) — drives the HUD pulse. */
export function onSpeechPulse(cb: PulseListener): () => void {
  pulseListeners.add(cb);
  return () => pulseListeners.delete(cb);
}

// ---------------------------------------------------------------- voices

const MALE = /(alvaro|álvaro|jorge|pablo|raul|raúl|diego|gonzalo|enrique|carlos|gerardo|tomas|tomás|dario|darío|jorge|male|hombre)/i;
const FEMALE = /(elvira|dalia|helena|sabina|laura|paloma|lucia|lucía|elena|ximena|salome|salomé|paulina|monica|mónica|female|mujer)/i;
const NEURAL = /(natural|online|neural|premium|enhanced)/i;

export function listVoices(lang = "es"): SpeechSynthesisVoice[] {
  if (!ttsAvailable()) return [];
  const base = lang.slice(0, 2).toLowerCase();
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(base));
}

export function preferredVoiceURI(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("nova.voice") || "";
  } catch {
    return "";
  }
}

export function setPreferredVoiceURI(uri: string) {
  try {
    if (uri) localStorage.setItem("nova.voice", uri);
    else localStorage.removeItem("nova.voice");
  } catch {
    /* ignore */
  }
}

export function pickVoice(lang = "es-ES", persona = "JARVIS"): SpeechSynthesisVoice | null {
  const voices = listVoices(lang);
  if (voices.length === 0) return null;
  const chosen = preferredVoiceURI();
  if (chosen) {
    const v = voices.find((x) => x.voiceURI === chosen);
    if (v) return v;
  }
  const wantMale = (persona || "JARVIS").toUpperCase() === "JARVIS";
  const gender = wantMale ? MALE : FEMALE;
  const score = (v: SpeechSynthesisVoice) =>
    (NEURAL.test(v.name) ? 4 : 0) +
    (/google/i.test(v.name) ? 2 : 0) +
    (gender.test(v.name) ? 3 : 0) +
    (v.lang.toLowerCase() === lang.toLowerCase() ? 1 : 0);
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

export function warmUpVoices() {
  if (!ttsAvailable()) return;
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices());
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- speaking

/** Turns markdown/code into something that sounds natural when read aloud. */
export function toSpeakable(md: string): string {
  return (md || "")
    .replace(/```[\s\S]*?```/g, " (te dejo el código en pantalla) ")
    .replace(/```[\s\S]*$/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "el enlace")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, "")
    .replace(/[*_~>#|]/g, "")
    .replace(/⚠️/g, "Atención:")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------- engines

export type TtsEngine = "gemini" | "browser";

let neuralAvailable = false;
let neuralCooldownUntil = 0;

/** Called once the backend reports whether Gemini TTS is configured. */
export function setNeuralAvailable(on: boolean) {
  neuralAvailable = on;
}

export function neuralVoiceAvailable(): boolean {
  return neuralAvailable;
}

export function preferredEngine(): TtsEngine {
  if (typeof window === "undefined") return "browser";
  try {
    return localStorage.getItem("nova.ttsEngine") === "browser" ? "browser" : "gemini";
  } catch {
    return "gemini";
  }
}

export function setPreferredEngine(e: TtsEngine) {
  try {
    localStorage.setItem("nova.ttsEngine", e);
  } catch {
    /* ignore */
  }
}

/** Engine actually used right now (Gemini unless unavailable, disabled, or cooling down after a quota error). */
export function activeEngine(): TtsEngine {
  return neuralAvailable && preferredEngine() === "gemini" && Date.now() > neuralCooldownUntil ? "gemini" : "browser";
}

/** Queue one chunk of speech (does not cancel what's already queued). */
export function speakChunk(text: string, opts: { lang?: string; persona?: string } = {}): void {
  const clean = toSpeakable(text);
  if (!clean) return;
  if (activeEngine() === "gemini") {
    enqueueNeural(clean, opts);
    return;
  }
  speakBrowser(clean, opts);
}

function speakBrowser(clean: string, opts: { lang?: string; persona?: string }): void {
  if (!ttsAvailable() || !clean) return;
  const synth = window.speechSynthesis;
  const myGen = generation;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = opts.lang || "es-ES";
  const persona = (opts.persona || "JARVIS").toUpperCase();
  u.rate = persona === "EDITH" ? 1.08 : persona === "FRIDAY" ? 1.06 : 1.0;
  u.pitch = persona === "JARVIS" ? 0.95 : 1.0;
  const v = pickVoice(u.lang, persona);
  if (v) u.voice = v;
  const finish = () => {
    if (myGen === generation) setPending(pending - 1);
  };
  u.onend = finish;
  u.onerror = finish;
  u.onboundary = () => pulseListeners.forEach((l) => l());
  setPending(pending + 1);
  synth.speak(u);
  // Chrome occasionally parks the queue; nudge it.
  window.setTimeout(() => {
    try {
      if (synth.paused) synth.resume();
    } catch {
      /* ignore */
    }
  }, 200);
}

// ---------------------------------------------------------------- Gemini neural voice

interface NeuralJob {
  text: string;
  opts: { lang?: string; persona?: string };
  gen: number;
  audio: Promise<ArrayBuffer | null>;
  controller: AbortController;
}

const neuralQueue: NeuralJob[] = [];
let neuralPlaying = false;
let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let pulseRaf = 0;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Call from a user gesture (click / tap) so later playback isn't blocked by autoplay rules. */
export function unlockAudio() {
  ctx();
}

async function fetchNeural(text: string, persona: string, signal: AbortSignal): Promise<ArrayBuffer | null> {
  try {
    const { API_URL } = await import("./api");
    const { useAuthStore } = await import("@/store/authStore");
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(`${API_URL}/api/voice/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ text, persona }),
      signal,
    });
    if (res.status === 429 || res.status === 503) {
      neuralCooldownUntil = Date.now() + 90_000; // quota / not configured: browser voice for a while
      return null;
    }
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function enqueueNeural(text: string, opts: { lang?: string; persona?: string }) {
  const controller = new AbortController();
  const job: NeuralJob = {
    text,
    opts,
    gen: generation,
    controller,
    // Start fetching immediately so the next chunk is ready while the current one plays.
    audio: fetchNeural(text, (opts.persona || "JARVIS").toUpperCase(), controller.signal),
  };
  setPending(pending + 1);
  neuralQueue.push(job);
  void playNext();
}

async function playNext(): Promise<void> {
  if (neuralPlaying) return;
  const job = neuralQueue.shift();
  if (!job) return;
  neuralPlaying = true;
  const done = () => {
    neuralPlaying = false;
    if (job.gen === generation) setPending(pending - 1);
    void playNext();
  };
  const data = await job.audio;
  if (job.gen !== generation) {
    neuralPlaying = false;
    void playNext();
    return;
  }
  const c = ctx();
  if (!data || !c || c.state !== "running") {
    // Fallback: say this chunk with the browser voice, keep the queue order.
    neuralPlaying = false;
    setPending(pending - 1);
    speakBrowser(job.text, job.opts);
    void playNext();
    return;
  }
  try {
    const buffer = await c.decodeAudioData(data.slice(0));
    if (job.gen !== generation) {
      neuralPlaying = false;
      void playNext();
      return;
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const analyser = c.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyser.connect(c.destination);
    currentSource = src;
    src.onended = () => {
      if (currentSource === src) currentSource = null;
      cancelAnimationFrame(pulseRaf);
      done();
    };
    // Drive the HUD pulse from the actual audio energy.
    const buf = new Uint8Array(analyser.fftSize);
    let last = 0;
    const tick = () => {
      pulseRaf = requestAnimationFrame(tick);
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const x = (buf[i] - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (rms > 0.06 && now - last > 110) {
        last = now;
        pulseListeners.forEach((l) => l());
      }
    };
    tick();
    src.start();
  } catch {
    neuralPlaying = false;
    setPending(pending - 1);
    speakBrowser(job.text, job.opts);
    void playNext();
  }
}

/** Stop talking immediately (barge-in, new conversation, mute). */
export function cancelAll(): void {
  generation++;
  if (ttsAvailable()) window.speechSynthesis.cancel();
  while (neuralQueue.length) neuralQueue.shift()?.controller.abort();
  try {
    currentSource?.stop();
  } catch {
    /* already stopped */
  }
  currentSource = null;
  neuralPlaying = false;
  cancelAnimationFrame(pulseRaf);
  setPending(0);
}

/**
 * Feeds streaming tokens and speaks complete sentences as soon as they're ready.
 * The first chunk goes out early (first sentence, or a comma after ~60 chars) to minimise latency.
 */
export class SentenceSpeaker {
  private buffer = "";
  private inCode = false;
  private spokeFirst = false;
  constructor(private opts: { lang?: string; persona?: string } = {}) {}

  push(token: string) {
    this.buffer += token;
    // Track fenced code blocks — never read code aloud mid-stream.
    const fences = (this.buffer.match(/```/g) || []).length;
    this.inCode = fences % 2 === 1;
    if (this.inCode) return;
    this.drain(false);
  }

  flush() {
    this.drain(true);
  }

  private drain(final: boolean) {
    while (true) {
      const text = this.buffer;
      if (!text.trim()) return;
      let cut = -1;
      // Never cut inside a (closed) code block: the first cut must come after the last fence.
      const lastFence = text.lastIndexOf("```");
      const minCut = Math.max(12, lastFence >= 0 ? lastFence + 3 : 0);
      const sentence = /[.!?…:;](\s|$)|\n\n/g;
      let m: RegExpExecArray | null;
      while ((m = sentence.exec(text))) {
        const end = m.index + m[0].length;
        if (end >= minCut) {
          cut = end;
          break;
        }
      }
      if (cut < 0 && !this.spokeFirst && text.length > 60 && lastFence < 0) {
        const comma = text.indexOf(", ", 40);
        if (comma > 0) cut = comma + 1;
      }
      // Neural voice: after the first quick sentence, group sentences (~200+ chars) to save quota.
      if (cut > 0 && this.spokeFirst && activeEngine() === "gemini" && cut < 200) {
        let later = -1;
        let mm: RegExpExecArray | null;
        const again = /[.!?…:;](\s|$)|\n\n/g;
        while ((mm = again.exec(text))) {
          const end = mm.index + mm[0].length;
          if (end >= 200) {
            later = end;
            break;
          }
        }
        if (later > 0) cut = later;
        else if (!final) return; // wait for more text
        else cut = text.length;
      }
      if (cut < 0) {
        if (final) {
          speakChunk(text, this.opts);
          this.buffer = "";
        }
        return;
      }
      const chunk = text.slice(0, cut);
      this.buffer = text.slice(cut);
      if (toSpeakable(chunk)) {
        speakChunk(chunk, this.opts);
        this.spokeFirst = true;
      }
    }
  }
}
