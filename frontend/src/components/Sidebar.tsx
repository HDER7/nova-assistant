"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, CheckSquare, StickyNote,
  CalendarDays, BrainCircuit, Settings, Wand2, ShieldAlert, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ArcReactor } from "@/components/ArcReactor";
import { useAuthStore } from "@/store/authStore";

const NAV = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/tasks", label: "Tareas", icon: CheckSquare },
  { href: "/notes", label: "Notas", icon: StickyNote },
  { href: "/calendar", label: "Calendario", icon: CalendarDays },
  { href: "/memory", label: "Memoria", icon: BrainCircuit },
  { href: "/tools", label: "Herramientas", icon: Wand2 },
  { href: "/soc", label: "SOC", icon: ShieldAlert },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface/95 backdrop-blur-md transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <ArcReactor size={34} />
            <div>
              <p className="text-sm font-semibold leading-tight tracking-[0.24em]">NOVA</p>
              <p className="nova-label mt-0.5">Assistant</p>
            </div>
          </Link>
          <button className="text-muted-foreground md:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] uppercase tracking-[0.12em] transition",
                  active
                    ? "bg-muted/50 text-foreground"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-primary" />
                )}
                <Icon className={cn("h-[18px] w-[18px]", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="m-3 rounded-md border border-border bg-background/40 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              {(user?.displayName || "N").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.displayName || "Usuario"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
