"use client";

import { useEffect, useState } from "react";
import { Workflow, Plus, Trash2, Loader2, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import type { Protocol } from "@/lib/types";

/** List built-in protocols and create / delete your own ("NOVA, protocolo <nombre>"). */
export function ProtocolsPanel() {
  const pushToast = useUIStore((s) => s.pushToast);
  const [items, setItems] = useState<Protocol[]>([]);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api.get<Protocol[]>("/api/protocols").then(setItems).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !steps.trim()) return;
    setSaving(true);
    try {
      await api.post("/api/protocols", { name: name.trim(), steps: steps.trim() });
      setName("");
      setSteps("");
      pushToast({ title: "Protocolo guardado", variant: "success" });
      load();
    } catch {
      pushToast({ title: "No se pudo guardar el protocolo", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/api/protocols/${id}`);
      load();
    } catch {
      pushToast({ title: "No se pudo eliminar", variant: "error" });
    }
  }

  return (
    <section className="nova-card space-y-4">
      <div>
        <h2 className="flex items-center gap-2 font-semibold"><Workflow className="h-4 w-4 text-primary" /> Protocolos</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Rutinas que NOVA ejecuta al decir <span className="font-mono text-foreground">“NOVA, protocolo &lt;nombre&gt;”</span>.
          Si creas uno con el mismo nombre que uno integrado, el tuyo lo reemplaza.
        </p>
      </div>

      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id ?? p.name} className="rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium capitalize">{p.name}</p>
              {p.builtIn ? (
                <span className="nova-chip"><Lock className="h-3 w-3" /> Integrado</span>
              ) : (
                <button onClick={() => p.id && remove(p.id)} className="text-muted-foreground hover:text-danger" title="Eliminar">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 whitespace-pre-line text-xs text-muted-foreground">{p.steps}</p>
          </div>
        ))}
      </div>

      <form onSubmit={create} className="space-y-2 border-t border-border pt-4">
        <p className="nova-label">Nuevo protocolo</p>
        <input value={name} onChange={(e) => setName(e.target.value)} className="nova-input" placeholder="Nombre, ej: phishing masivo" maxLength={80} />
        <textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          className="nova-input min-h-[110px]"
          maxLength={4000}
          placeholder={"Pasos en lenguaje natural, ej:\n1) Usa kev_recent (7 días) filtrando por Microsoft.\n2) Crea una tarea urgente por cada CVE con ransomware.\n3) Resume en 3 frases."}
        />
        <button type="submit" disabled={saving || !name.trim() || !steps.trim()} className="nova-btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar protocolo
        </button>
      </form>
    </section>
  );
}
