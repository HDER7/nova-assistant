"use client";

import { useEffect, useState } from "react";
import { AudioLines, Play } from "lucide-react";
import { listVoices, pickVoice, preferredVoiceURI, setPreferredVoiceURI, cancelAll, ttsAvailable, warmUpVoices } from "@/lib/tts";
import { speak } from "@/lib/speech";
import { announcementsEnabled, setAnnouncementsEnabled } from "@/components/ProactiveAnnouncer";

const SAMPLE: Record<string, string> = {
  JARVIS: "A su servicio, señor. Todos los sistemas están operativos.",
  FRIDAY: "¡Hola, jefe! Todo en orden por aquí. ¿Qué hacemos hoy?",
  EDITH: "Sistemas en línea. Sin amenazas activas. A la espera de órdenes.",
};

/** Voice picker (neural voices first), test button and spoken-announcements toggle. */
export function VoiceSettings({ persona, lang }: { persona: string; lang: string }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [chosen, setChosen] = useState("");
  const [announce, setAnnounce] = useState(true);

  useEffect(() => {
    warmUpVoices();
    const load = () => setVoices(listVoices(lang));
    load();
    setChosen(preferredVoiceURI());
    setAnnounce(announcementsEnabled());
    if (ttsAvailable()) window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      if (ttsAvailable()) window.speechSynthesis.removeEventListener?.("voiceschanged", load);
    };
  }, [lang]);

  const auto = pickVoice(lang, persona);
  const sorted = [...voices].sort((a, b) => {
    const n = (v: SpeechSynthesisVoice) => (/(natural|online|neural)/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : 2);
    return n(a) - n(b) || a.name.localeCompare(b.name);
  });

  return (
    <section className="nova-card space-y-4">
      <h2 className="flex items-center gap-2 font-semibold"><AudioLines className="h-4 w-4 text-primary" /> Voz de NOVA</h2>
      {!ttsAvailable() ? (
        <p className="text-sm text-muted-foreground">Tu navegador no permite síntesis de voz.</p>
      ) : (
        <>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Voz</label>
            <div className="flex gap-2">
              <select
                value={chosen}
                onChange={(e) => {
                  setChosen(e.target.value);
                  setPreferredVoiceURI(e.target.value);
                }}
                className="nova-input"
              >
                <option value="">Automática según personalidad{auto ? ` (${auto.name})` : ""}</option>
                {sorted.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {/(natural|online|neural)/i.test(v.name) ? "★ " : ""}{v.name} — {v.lang}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { cancelAll(); speak(SAMPLE[persona] || SAMPLE.JARVIS, lang, undefined, persona); }}
                className="nova-btn-ghost shrink-0"
                title="Probar voz"
              >
                <Play className="h-4 w-4" /> Probar
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              ★ = voz neuronal (más natural). En Microsoft Edge aparecen voces "Natural" en español muy realistas.
            </p>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3">
            <span>
              <span className="block text-sm">Avisos hablados</span>
              <span className="block text-xs text-muted-foreground">
                NOVA dice en voz alta recordatorios, eventos próximos y CVEs explotados mientras la app está abierta.
              </span>
            </span>
            <input
              type="checkbox"
              checked={announce}
              onChange={(e) => {
                setAnnounce(e.target.checked);
                setAnnouncementsEnabled(e.target.checked);
              }}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
          </label>
        </>
      )}
    </section>
  );
}
