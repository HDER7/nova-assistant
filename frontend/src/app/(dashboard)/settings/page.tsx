"use client";

import { useEffect, useState } from "react";
import { Save, User as UserIcon, Palette, Loader2, Cpu, Cloud } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { useTheme } from "@/providers/ThemeProvider";
import type { User } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";

type EngineStatus = {
  provider: string;
  live: boolean;
  model: string;
  local: { enabled: boolean; label: string; baseUrl: string; reachable: boolean };
};

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const pushToast = useUIStore((s) => s.pushToast);
  const { setTheme } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [theme, setThemePref] = useState("dark");
  const [locale, setLocale] = useState("es");
  const [persona, setPersona] = useState("NOVA");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [engine, setEngine] = useState<EngineStatus | null>(null);

  useEffect(() => {
    api.get<User>("/api/users/me").then((u) => {
      setUser(u);
      setDisplayName(u.displayName);
      setAvatarUrl(u.avatarUrl || "");
      setThemePref(u.theme);
      setLocale(u.locale);
      setPersona(u.persona);
    }).catch(() => {});
    api.get<EngineStatus>("/api/chat/status").then(setEngine).catch(() => {});
  }, [setUser]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await api.patch<User>("/api/users/me", { displayName, avatarUrl });
      setUser(updated);
      pushToast({ title: "Perfil actualizado", variant: "success" });
    } catch {
      pushToast({ title: "No se pudo actualizar", variant: "error" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const updated = await api.patch<User>("/api/users/me/preferences", { theme, locale, persona });
      setUser(updated);
      setTheme(theme === "light" ? "light" : "dark");
      pushToast({ title: "Preferencias guardadas", variant: "success" });
    } catch {
      pushToast({ title: "No se pudo guardar", variant: "error" });
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Personaliza tu cuenta y tu asistente.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="nova-card space-y-4">
          <h2 className="flex items-center gap-2 font-semibold"><UserIcon className="h-4 w-4 text-primary" /> Perfil</h2>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Nombre</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="nova-input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">URL de avatar</label>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="nova-input" placeholder="https://…" />
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            <p>Correo: <span className="text-foreground">{user?.email}</span></p>
            <p>Rol: <span className="text-foreground">{user?.role}</span></p>
            <p>Miembro desde: <span className="text-foreground">{formatDate(user?.createdAt, { dateStyle: "long" })}</span></p>
          </div>
          <button type="submit" disabled={savingProfile} className="nova-btn-primary">
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar perfil
          </button>
        </form>

        <form onSubmit={savePrefs} className="nova-card space-y-4">
          <h2 className="flex items-center gap-2 font-semibold"><Palette className="h-4 w-4 text-primary" /> Preferencias</h2>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Tema</label>
            <select value={theme} onChange={(e) => setThemePref(e.target.value)} className="nova-input">
              <option value="dark">Oscuro</option>
              <option value="light">Claro</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Idioma</label>
            <select value={locale} onChange={(e) => setLocale(e.target.value)} className="nova-input">
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Personalidad del asistente</label>
            <input value={persona} onChange={(e) => setPersona(e.target.value)} className="nova-input" placeholder="NOVA" />
          </div>
          <button type="submit" disabled={savingPrefs} className="nova-btn-primary">
            {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar preferencias
          </button>
        </form>
      </div>

      <section className="nova-card space-y-4">
        <h2 className="flex items-center gap-2 font-semibold"><Cpu className="h-4 w-4 text-primary" /> Motor de IA</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm"><Cloud className="h-4 w-4 text-muted-foreground" /> Nube</span>
              <span className={cn("nova-chip", engine?.live ? "border-success/40 text-success" : "text-muted-foreground")}>
                {engine?.live ? "En línea" : "Mock"}
              </span>
            </div>
            <p className="mt-2 truncate text-xs text-muted-foreground">{engine?.provider ?? "—"}</p>
          </div>

          <div className="rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm"><Cpu className="h-4 w-4 text-muted-foreground" /> {engine?.local.label ?? "Local (OpenJarvis)"}</span>
              <span className={cn("nova-chip", engine?.local.reachable ? "border-success/40 text-success" : "border-primary/40 text-primary")}>
                {engine?.local.reachable ? "En línea" : "Sin conexión"}
              </span>
            </div>
            <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{engine?.local.baseUrl ?? "http://localhost:8000/v1"}</p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Cerebro local — 100% privado y offline</p>
          <p>
            Selecciona <span className="text-foreground">“{engine?.local.label ?? "Local (OpenJarvis)"}”</span> en el
            desplegable de modelo del chat para que la inferencia corra en tu propia máquina, sin enviar datos a la nube.
            Levanta el motor con <span className="font-mono text-foreground">jarvis serve --port 8000</span> (OpenJarvis)
            o apunta <span className="font-mono text-foreground">NOVA_AI_LOCAL_BASE_URL</span> a tu Ollama
            (<span className="font-mono text-foreground">http://localhost:11434/v1</span>). Las herramientas, SOC y memoria
            de NOVA siguen funcionando igual.
          </p>
        </div>
      </section>
    </div>
  );
}
