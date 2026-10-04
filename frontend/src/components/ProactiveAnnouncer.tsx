"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { speakChunk, ttsAvailable } from "@/lib/tts";
import { playConfirm, playOnline } from "@/lib/sound";
import type { NovaNotification } from "@/lib/types";

const SPOKEN_TYPES = new Set(["REMINDER", "ALERT", "WARNING"]);

export function announcementsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("nova.announce") !== "off";
  } catch {
    return true;
  }
}

export function setAnnouncementsEnabled(on: boolean) {
  try {
    localStorage.setItem("nova.announce", on ? "on" : "off");
  } catch {
    /* ignore */
  }
}

/**
 * JARVIS speaks first: when a reminder fires, an event is about to start or a new exploited CVE
 * shows up, NOVA says it out loud (and shows a toast). Only notifications that arrive while the app
 * is open are announced — the backlog is never read out on load.
 */
export function ProactiveAnnouncer() {
  const user = useAuthStore((s) => s.user);
  const pushToast = useUIStore((s) => s.pushToast);
  const seen = useRef<Set<string> | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let stopped = false;

    const address = () => {
      const u = userRef.current;
      const persona = (u?.persona || "JARVIS").toUpperCase();
      const parts = (u?.displayName || "").trim().split(/\s+/).filter(Boolean);
      const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
      if (persona === "FRIDAY") return "Jefe, ";
      if (persona === "EDITH") return "";
      return surname ? `Señor ${surname}, ` : "Señor, ";
    };

    const poll = async () => {
      try {
        const list = await api.get<NovaNotification[]>("/api/notifications");
        if (stopped) return;
        if (seen.current === null) {
          seen.current = new Set(list.map((n) => n.id)); // first load: remember, don't announce
          return;
        }
        const fresh = list.filter((n) => !seen.current!.has(n.id) && !n.read);
        list.forEach((n) => seen.current!.add(n.id));
        for (const n of fresh.slice(0, 3)) {
          const spoken = SPOKEN_TYPES.has(n.type);
          if (n.type === "ALERT") playOnline();
          else playConfirm();
          pushToast({ title: n.title, description: n.body || undefined, variant: n.type === "ALERT" ? "error" : "default" });
          if (spoken && announcementsEnabled() && ttsAvailable()) {
            const persona = (userRef.current?.persona || "JARVIS").toUpperCase();
            const lang = userRef.current?.locale === "en" ? "en-US" : "es-ES";
            const prefix = n.type === "ALERT" ? `${address()}alerta de seguridad. ` : address();
            const body = n.body && n.body.length < 220 ? ` ${n.body}` : "";
            speakChunk(`${prefix}${n.title}.${body}`, { lang, persona });
          }
        }
      } catch {
        /* offline or session expired — try again next tick */
      }
    };

    poll();
    const id = window.setInterval(poll, 25_000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [pushToast]);

  return null;
}
