"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (typeof window !== "undefined"
      ? (localStorage.getItem("nova-theme") as Theme | null)
      : null) ?? "dark";
    apply(stored);
    setThemeState(stored);
  }, []);

  function apply(next: Theme) {
    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
  }

  function setTheme(next: Theme) {
    apply(next);
    setThemeState(next);
    localStorage.setItem("nova-theme", next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(theme === "dark" ? "light" : "dark"), setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
