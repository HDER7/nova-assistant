"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { ArcReactor } from "@/components/ArcReactor";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !accessToken) router.replace("/login");
  }, [hydrated, accessToken, router]);

  if (!hydrated || !accessToken) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ArcReactor size={120} active />
        <p className="text-sm text-muted-foreground">Inicializando NOVA…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:pl-64">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <Topbar onMenu={() => setMenuOpen(true)} />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
