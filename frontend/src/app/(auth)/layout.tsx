import { ArcReactor, HeiderLockup } from "@/components/ArcReactor";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-border md:grid-cols-2">
        {/* Brand plate — red field, black mark (Heider Industries) */}
        <div className="relative hidden flex-col justify-between bg-primary p-10 text-[#0a0a0a] md:flex">
          <div className="flex items-center gap-3">
            <ArcReactor size={30} tone="dark" />
            <span className="text-sm font-black tracking-[0.3em]">NOVA</span>
          </div>
          <div className="flex justify-center py-6">
            <HeiderLockup width={300} tone="dark" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-[0.12em]">Asistente personal</h2>
            <p className="mt-2 text-sm font-medium text-black/70">
              Voz, memoria, protocolos y análisis SOC. Sistemas de Heider Industries.
            </p>
          </div>
        </div>

        <div className="bg-surface/80 p-8 backdrop-blur md:p-10">
          {/* Mobile: compact lockup above the form */}
          <div className="mb-8 flex justify-center md:hidden">
            <HeiderLockup width={220} tone="red" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
