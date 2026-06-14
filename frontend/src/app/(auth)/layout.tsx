import { ArcReactor } from "@/components/ArcReactor";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border md:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-primary/10 via-background to-accent/10 p-10 md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 font-mono text-lg font-bold text-primary glow-text">
              N
            </div>
            <span className="text-lg font-semibold tracking-wide">NOVA</span>
          </div>
          <div className="flex justify-center py-8">
            <ArcReactor size={220} active />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Tu asistente personal del futuro.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Conversación inteligente, memoria persistente, voz, tareas, calendario y un panel de
              control de nivel empresarial.
            </p>
          </div>
        </div>
        <div className="bg-surface/60 p-8 backdrop-blur md:p-10">{children}</div>
      </div>
    </div>
  );
}
