"use client";

import { api } from "@/lib/api";
import { emitSpeechPulse } from "@/lib/tts";
import type { ToolCard } from "@/lib/types";

/**
 * Gemini Live: real-time, audio-to-audio conversation straight from the browser to Google.
 * The backend only mints a short-lived token and runs NOVA's tools. Interruptions are detected by
 * Gemini's own voice activity detection (the "interrupted" signal stops playback immediately).
 */
export type LivePhase = "connecting" | "listening" | "thinking" | "speaking" | "closed";

export interface LiveCallbacks {
  onPhase: (p: LivePhase) => void;
  onUserText: (text: string) => void;
  onModelText: (text: string) => void;
  onTurnStart: () => void;
  onCard: (card: ToolCard) => void;
  onError: (message: string) => void;
}

const IN_RATE = 16000;
const OUT_RATE = 24000;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Linear-interpolation resample of a Float32 block to 16 kHz Int16 PCM. */
function downsample(input: Float32Array, fromRate: number): Int16Array {
  if (fromRate === IN_RATE) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
    return out;
  }
  const ratio = fromRate / IN_RATE;
  const len = Math.floor(input.length / ratio);
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const v = input[i0] + (input[i1] - input[i0]) * (pos - i0);
    out[i] = Math.max(-1, Math.min(1, v)) * 0x7fff;
  }
  return out;
}

export function liveSupported(): boolean {
  return typeof window !== "undefined" && typeof WebSocket !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export class GeminiLive {
  /** Smoothed microphone level 0..1 for visuals. */
  readonly levelRef = { current: 0 };
  private ws: WebSocket | null = null;
  private micStream: MediaStream | null = null;
  private inCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outCtx: AudioContext | null = null;
  private outGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextTime = 0;
  private raf = 0;
  private closed = false;
  private turnOpen = false;
  private phase: LivePhase = "connecting";

  constructor(private cb: LiveCallbacks) {}

  async start(): Promise<void> {
    this.setPhase("connecting");
    // Audio contexts must be created inside the user gesture that started the session.
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try {
      this.outCtx = new AC({ sampleRate: OUT_RATE });
    } catch {
      this.outCtx = new AC();
    }
    this.inCtx = new AC();
    void this.outCtx.resume();
    void this.inCtx.resume();

    let session: { url: string; setup: unknown };
    try {
      session = await api.post<{ url: string; setup: unknown }>("/api/live/session", {});
    } catch (e) {
      this.fail(e instanceof Error ? e.message : "No se pudo iniciar Gemini Live");
      return;
    }
    if (this.closed) return;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch {
      this.fail("No se pudo acceder al micrófono");
      return;
    }
    if (this.closed) {
      this.micStream.getTracks().forEach((t) => t.stop());
      return;
    }

    this.outGain = this.outCtx.createGain();
    this.analyser = this.outCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.outGain.connect(this.analyser);
    this.analyser.connect(this.outCtx.destination);

    const ws = new WebSocket(session.url);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(session.setup));
    ws.onmessage = (ev) => void this.onMessage(ev);
    ws.onerror = () => {
      if (!this.closed) this.fail("Se perdió la conexión con Gemini Live");
    };
    ws.onclose = (ev) => {
      if (this.closed) return;
      const reason = ev.reason ? ` (${ev.reason})` : "";
      this.fail(ev.code === 1000 ? "Sesión de Gemini Live finalizada" : `Gemini Live cerró la sesión${reason}`);
    };
    this.loop();
  }

  sendText(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !text.trim()) return;
    this.stopPlayback();
    this.cb.onUserText(text);
    this.ws.send(JSON.stringify({ realtimeInput: { text } }));
    this.setPhase("thinking");
  }

  close() {
    this.closed = true;
    cancelAnimationFrame(this.raf);
    try {
      this.processor?.disconnect();
    } catch {
      /* ignore */
    }
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.stopPlayback();
    try {
      this.ws?.close(1000);
    } catch {
      /* ignore */
    }
    void this.inCtx?.close().catch(() => {});
    void this.outCtx?.close().catch(() => {});
    this.levelRef.current = 0;
    this.setPhase("closed");
  }

  // ------------------------------------------------------------------ internals

  private setPhase(p: LivePhase) {
    if (p === this.phase) return;
    this.phase = p;
    this.cb.onPhase(p);
  }

  private fail(msg: string) {
    if (this.closed) return;
    this.cb.onError(msg);
    this.close();
  }

  private startMic() {
    if (!this.inCtx || !this.micStream || this.processor) return;
    const src = this.inCtx.createMediaStreamSource(this.micStream);
    // ScriptProcessor is deprecated but universally supported and simple; ~85 ms blocks at 48 kHz.
    const proc = this.inCtx.createScriptProcessor(4096, 1, 1);
    const rate = this.inCtx.sampleRate;
    proc.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      this.levelRef.current = this.levelRef.current * 0.6 + Math.min(1, rms / 0.2) * 0.4;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const pcm = downsample(data, rate);
      this.ws.send(JSON.stringify({
        realtimeInput: { audio: { data: toBase64(new Uint8Array(pcm.buffer)), mimeType: `audio/pcm;rate=${IN_RATE}` } },
      }));
    };
    // Route through a muted gain so the processor runs without echoing the mic to the speakers.
    const mute = this.inCtx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(this.inCtx.destination);
    this.processor = proc;
  }

  private async onMessage(ev: MessageEvent) {
    let raw: string;
    if (typeof ev.data === "string") raw = ev.data;
    else if (ev.data instanceof Blob) raw = await ev.data.text();
    else raw = new TextDecoder().decode(ev.data as ArrayBuffer);
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }

    if (m.setupComplete) {
      this.startMic();
      this.setPhase("listening");
      return;
    }

    const sc = m.serverContent as
      | {
          modelTurn?: { parts?: { inlineData?: { data: string; mimeType?: string }; text?: string }[] };
          inputTranscription?: { text?: string };
          outputTranscription?: { text?: string };
          interrupted?: boolean;
          turnComplete?: boolean;
        }
      | undefined;
    if (sc) {
      if (sc.interrupted) {
        this.stopPlayback();
        this.turnOpen = false;
        this.setPhase("listening");
      }
      if (sc.inputTranscription?.text) this.cb.onUserText(sc.inputTranscription.text);
      if (sc.outputTranscription?.text) {
        if (!this.turnOpen) {
          this.turnOpen = true;
          this.cb.onTurnStart();
        }
        this.cb.onModelText(sc.outputTranscription.text);
      }
      for (const part of sc.modelTurn?.parts || []) {
        if (part.inlineData?.data && (part.inlineData.mimeType || "audio/pcm").startsWith("audio")) {
          if (!this.turnOpen) {
            this.turnOpen = true;
            this.cb.onTurnStart();
          }
          const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1] || OUT_RATE);
          this.playPcm(fromBase64(part.inlineData.data), rate);
        }
      }
      if (sc.turnComplete) this.turnOpen = false;
    }

    const toolCall = m.toolCall as { functionCalls?: { id: string; name: string; args?: Record<string, unknown> }[] } | undefined;
    if (toolCall?.functionCalls?.length) {
      this.setPhase("thinking");
      const responses = await Promise.all(
        toolCall.functionCalls.map(async (fc) => {
          this.cb.onCard({ id: fc.id, tool: fc.name, phase: "start", title: fc.name, status: "running" });
          try {
            const r = await api.post<{ result: string; card: ToolCard }>("/api/live/tool", {
              id: fc.id,
              name: fc.name,
              args: fc.args || {},
            });
            if (r.card) this.cb.onCard(r.card);
            return { id: fc.id, name: fc.name, response: { result: r.result } };
          } catch (e) {
            const msg = e instanceof Error ? e.message : "error";
            this.cb.onCard({ id: fc.id, tool: fc.name, phase: "done", title: fc.name, status: "error", text: msg });
            return { id: fc.id, name: fc.name, response: { error: msg } };
          }
        })
      );
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
      }
    }

    if (m.goAway) this.cb.onError("Gemini Live cerrará la sesión en breve (límite de duración). Reactívala si quieres seguir.");
  }

  private playPcm(bytes: Uint8Array, rate: number) {
    const ctx = this.outCtx;
    if (!ctx || !this.outGain) return;
    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const buffer = ctx.createBuffer(1, samples.length, rate);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.outGain);
    const start = Math.max(ctx.currentTime + 0.02, this.nextTime);
    src.start(start);
    this.nextTime = start + buffer.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  private stopPlayback() {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    });
    this.sources.clear();
    this.nextTime = 0;
  }

  private loop() {
    const buf = new Uint8Array(256);
    let last = 0;
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      const ctx = this.outCtx;
      if (!ctx || this.phase === "connecting" || this.phase === "closed") return;
      const playing = this.sources.size > 0 && this.nextTime > ctx.currentTime;
      if (playing) {
        this.setPhase("speaking");
        if (this.analyser) {
          this.analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const x = (buf[i] - 128) / 128;
            sum += x * x;
          }
          const now = performance.now();
          if (Math.sqrt(sum / buf.length) > 0.05 && now - last > 110) {
            last = now;
            emitSpeechPulse();
          }
        }
      } else if (this.phase === "speaking") {
        this.setPhase("listening");
      }
    };
    tick();
  }
}
