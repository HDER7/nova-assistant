import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-ES", opts ?? { dateStyle: "medium", timeStyle: "short" });
}

export function relativeTime(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value).getTime();
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const mins = Math.round(diff / 60000);
  const hours = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  if (abs < 3600000) return rtf.format(mins, "minute");
  if (abs < 86400000) return rtf.format(hours, "hour");
  return rtf.format(days, "day");
}

export function initials(name?: string): string {
  if (!name) return "N";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
