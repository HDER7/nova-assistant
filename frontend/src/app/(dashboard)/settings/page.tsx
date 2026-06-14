"use client";

import { useEffect, useState } from "react";
import { Save, User as UserIcon, Palette, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { useTheme } from "@/providers/ThemeProvider";
import type { User } from "@/lib/types";
import { formatDate } from "@/lib/utils";

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

  useEffect(() => {
    api.get<User>("/api/users/me").then((u) => {
      setUser(u);
      setDisplayName(u.displayName);
      setAvatarUrl(u.avatarUrl || "");
      setThemePref(u.theme);
      setLocale(u.locale);
      setPersona(u.persona);
    }).catch(() => {});
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
    </div>
  );
}
