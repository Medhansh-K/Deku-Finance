"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

// Also read by the pre-paint script in src/app/layout.tsx.
const THEME_STORAGE_KEY = "deku_theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // The init script already chose the class; mirror it into state.
  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
