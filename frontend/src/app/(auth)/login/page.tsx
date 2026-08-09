"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import type { AuthResponse } from "@/lib/types";
import { Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const pushToast = useUIStore((s) => s.pushToast);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const auth = await api.post<AuthResponse>("/api/auth/login", { email, password });
      setAuth(auth);
      pushToast({ title: `Bienvenido de nuevo, ${auth.user.displayName}`, variant: "success" });
      router.push("/");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo iniciar sesión";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-muted-foreground">Accede a tu centro de control NOVA.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Correo</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="nova-input"
            placeholder="tu@correo.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="nova-input"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="nova-btn-primary w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          Entrar
        </button>
      </form>

    </div>
  );
}
