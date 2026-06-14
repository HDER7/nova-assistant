import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster } from "@/components/Toaster";

export const metadata: Metadata = {
  title: "NOVA · Asistente Virtual",
  description: "NOVA — asistente personal avanzado con IA, memoria persistente, voz y panel de control futurista.",
};

export const viewport: Viewport = {
  themeColor: "#06b6d4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body>
        <div className="nova-backdrop" />
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
