"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Moon, Sun, LogOut, Sparkles, Volume2, VolumeX } from "lucide-react";
import { soundMuted, setSoundMuted, playConfirm } from "@/lib/sound";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuthStore } from "@/store/authStore";
import { NotificationsBell } from "@/components/NotificationsBell";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [status, setStatus] = useState<{ live: boolean; model: string } | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    api.get<{ live: boolean; model: string }>("/api/chat/status").then(setStatus).catch(() => {});
    setMuted(soundMuted());
  }, []);

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    if (!next) playConfirm();
  }

  function onLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md md:px-6">
      <button className="text-muted-foreground md:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[0.66rem] uppercase tracking-[0.14em]",
            status?.live ? "border-success/40 text-success" : "border-primary/50 text-primary"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", status?.live ? "bg-success" : "bg-primary")} />
          {status?.live ? "IA en línea" : "Motor local"}
        </span>
      </div>

      <div className="flex-1" />

      <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {status?.model || "nova"}
      </div>

      <NotificationsBell />

      <button
        onClick={toggleSound}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/50 text-muted-foreground hover:text-foreground"
        aria-label={muted ? "Activar sonidos" : "Silenciar sonidos"}
        title={muted ? "Activar sonidos" : "Silenciar sonidos"}
      >
        {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
      </button>

      <button
        onClick={toggle}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/50 text-muted-foreground hover:text-foreground"
        aria-label="Cambiar tema"
      >
        {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>

      <button
        onClick={onLogout}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/50 text-muted-foreground hover:text-danger"
        aria-label="Cerrar sesión"
      >
        <LogOut className="h-[18px] w-[18px]" />
      </button>
    </header>
  );
}
