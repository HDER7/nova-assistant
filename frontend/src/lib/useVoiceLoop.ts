"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { cancelAll, isSpeaking, onSpeakingChange } from "@/lib/tts";
import { playListen } from "@/lib/sound";

/**
 * Hands-free conversation loop, browser-agnostic (MediaRecorder + Whisper, no Web Speech API):
 *   calibrating → listening → recording → transcribing → responding → listening …
 * Barge-in: talking over NOVA (while it speaks or thinks) cuts it off and starts listening right away.
 */
export type VoicePhase = "off" | "calibrating" | "listening" | "recording" | "transcribing" | "responding";

type InternalState = Exclude<VoicePhase, "off"> | "idle";

export interface VoiceLoopOptions {
  enabled: boolean;
  /** Whisper language code, e.g. "es". */
  sttLang: string;
  /** True while a reply is streaming from the backend. */
  isBusy: () => boolean;
  /** A transcribed user utterance, ready to send. */
  onUtterance: (text: string) => void;
  /** The user started talking over NOVA: stop the in-flight reply. */
  onBargeIn?: () => void;
  onError?: (message: string) => void;
}

function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export function voiceCaptureSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

export function useVoiceLoop(options: VoiceLoopOptions) {
  const [phase, setPhase] = useState<VoicePhase>("off");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  /** Smoothed mic level 0..1 — read it from requestAnimationFrame for visuals (no re-renders). */
  const levelRef = useRef(0);
  const opts = useRef(options);
  opts.current = options;

  useEffect(() => {
    if (!options.enabled) {
      setPhase("off");
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let recorder: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let state: InternalState = "idle";
    const mime = pickAudioMime();

    const go = (s: InternalState) => {
      state = s;
      setPhase(s === "idle" ? "off" : s);
    };

    // Ignore the tail of NOVA's own voice for a moment after it stops talking.
    let echoGuardUntil = 0;
    const offSpeaking = onSpeakingChange((speaking) => {
      if (!speaking) echoGuardUntil = performance.now() + 500;
    });

    const transcribe = async (blob: Blob): Promise<string> => {
      if (blob.size < 1400) return "";
      const m = mime || blob.type || "audio/webm";
      const ext = m.includes("mp4") ? "mp4" : m.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("file", blob, `audio.${ext}`);
      form.append("language", opts.current.sttLang);
      try {
        const res = await api.postForm<{ text: string }>("/api/voice/transcribe", form);
        return (res.text || "").trim();
      } catch {
        return "";
      }
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        opts.current.onError?.("No se pudo acceder al micrófono");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      if (ctx.state === "suspended") void ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      source.connect(an);
      setAnalyser(an);

      const buf = new Uint8Array(an.fftSize);
      const SILENCE_MS = 850;
      const MAX_MS = 15000;
      const MIN_VOICED_MS = 300;
      const BARGE_MS = 220;
      const CALIBRATE_MS = 800;

      let noiseFloor = 0.01;
      let speechOn = 0.05;
      let speechOff = 0.03;
      const retune = () => {
        speechOn = Math.min(0.2, Math.max(0.035, noiseFloor * 3.2));
        speechOff = Math.min(0.14, Math.max(0.02, noiseFloor * 1.9));
      };
      const calStart = performance.now();
      const calSamples: number[] = [];
      let speechStart = 0;
      let silenceStart = 0;
      let voicedMs = 0;
      let bargeMs = 0;
      let respondingSince = 0;
      let lastFrame = performance.now();
      let discard = false;

      const startRecording = () => {
        try {
          chunks = [];
          recorder = mime ? new MediaRecorder(stream!, { mimeType: mime }) : new MediaRecorder(stream!);
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          recorder.onstop = async () => {
            if (cancelled) return;
            if (discard) {
              discard = false;
              go("listening");
              return;
            }
            go("transcribing");
            const blob = new Blob(chunks, { type: mime || "audio/webm" });
            let text = await transcribe(blob);
            if (cancelled) return;
            if (text) {
              // Optional wake word: "NOVA, …" → strip it.
              const idx = text.toLowerCase().indexOf("nova");
              if (idx >= 0 && idx < 6) text = text.slice(idx + 4).replace(/^[\s,.:;!?-]+/, "").trim();
            }
            if (text && text.length > 1) {
              playListen();
              respondingSince = performance.now();
              go("responding");
              opts.current.onUtterance(text);
            } else {
              go("listening");
            }
          };
          recorder.start();
        } catch {
          go("listening");
        }
      };

      const stopRecording = (drop: boolean) => {
        discard = drop;
        try {
          if (recorder && recorder.state === "recording") recorder.stop();
          else if (drop) go("listening");
        } catch {
          go("listening");
        }
      };

      const beginUtterance = (now: number) => {
        speechStart = now;
        silenceStart = 0;
        voicedMs = 0;
        go("recording");
        startRecording();
      };

      go("calibrating");

      const frame = () => {
        raf = requestAnimationFrame(frame);
        const now = performance.now();
        const dt = now - lastFrame;
        lastFrame = now;
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const x = (buf[i] - 128) / 128;
          sum += x * x;
        }
        const rms = Math.sqrt(sum / buf.length);
        levelRef.current = levelRef.current * 0.7 + Math.min(1, rms / 0.22) * 0.3;

        switch (state) {
          case "calibrating": {
            calSamples.push(rms);
            if (now - calStart > CALIBRATE_MS) {
              const sorted = [...calSamples].sort((a, b) => a - b);
              noiseFloor = sorted[Math.floor(sorted.length * 0.6)] || 0.01;
              retune();
              playListen();
              go("listening");
            }
            return;
          }
          case "listening": {
            if (isSpeaking() || opts.current.isBusy()) return;
            if (rms > speechOn && now > echoGuardUntil) {
              beginUtterance(now);
            } else if (rms < speechOn) {
              noiseFloor = noiseFloor * 0.995 + rms * 0.005; // follow the room slowly
              retune();
            }
            return;
          }
          case "recording": {
            if (rms > speechOff) voicedMs += dt;
            if (rms < speechOff) {
              if (!silenceStart) silenceStart = now;
              else if (now - silenceStart > SILENCE_MS) stopRecording(voicedMs < MIN_VOICED_MS);
            } else {
              silenceStart = 0;
            }
            if (now - speechStart > MAX_MS) stopRecording(false);
            return;
          }
          case "responding": {
            const speaking = isSpeaking();
            const busy = opts.current.isBusy();
            // Barge-in: louder bar while NOVA speaks (speaker echo), normal bar while it only thinks.
            const bar = speaking ? Math.max(speechOn * 2, 0.09) : speechOn * 1.3;
            if ((speaking || busy) && now - respondingSince > 600) {
              bargeMs = rms > bar ? bargeMs + dt : 0;
              if (bargeMs > BARGE_MS) {
                bargeMs = 0;
                cancelAll();
                opts.current.onBargeIn?.();
                beginUtterance(now);
                return;
              }
            }
            if (!speaking && !busy && now - respondingSince > 1200 && now > echoGuardUntil) {
              go("listening");
            }
            return;
          }
          default:
            return;
        }
      };
      raf = requestAnimationFrame(frame);
    })();

    return () => {
      cancelled = true;
      offSpeaking();
      cancelAnimationFrame(raf);
      try {
        if (recorder && recorder.state === "recording") recorder.stop();
      } catch {
        /* ignore */
      }
      stream?.getTracks().forEach((t) => t.stop());
      try {
        void ctx?.close();
      } catch {
        /* ignore */
      }
      setAnalyser(null);
      levelRef.current = 0;
      setPhase("off");
    };
  }, [options.enabled]);

  return { phase, analyser, levelRef };
}
