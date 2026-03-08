import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { batchThemes, type BatchTheme, type UserAccent } from "@/lib/themes";

interface ThemeContextType {
  batchTheme: BatchTheme;
  userAccent: UserAccent | null;
  setBatchTheme: (theme: BatchTheme) => void;
  setUserAccent: (accent: UserAccent | null) => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  customThemes: BatchTheme[];
  addCustomTheme: (theme: BatchTheme) => void;
  removeCustomTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const CUSTOM_THEMES_KEY = "scola-custom-themes";

function loadCustomThemes(): BatchTheme[] {
  try {
    const stored = localStorage.getItem(CUSTOM_THEMES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [batchTheme, setBatchTheme] = useState<BatchTheme>(batchThemes[6]);
  const [userAccent, setUserAccent] = useState<UserAccent | null>(null);
  const [isAdmin, setIsAdmin] = useState(true);
  const [customThemes, setCustomThemes] = useState<BatchTheme[]>(loadCustomThemes);

  const addCustomTheme = useCallback((theme: BatchTheme) => {
    setCustomThemes((prev) => {
      const next = [...prev, { ...theme, isCustom: true }];
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeCustomTheme = useCallback((id: string) => {
    setCustomThemes((prev) => {
      const next = prev.filter((t) => t.id !== id);
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next));
      return next;
    });
    // If the removed theme was active, fall back to default
    setBatchTheme((current) => (current.id === id ? batchThemes[6] : current));
  }, []);

  const applyTheme = useCallback(() => {
    const root = document.documentElement;
    const primary = userAccent ? userAccent.hsl : batchTheme.primary;

    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-foreground", batchTheme.primaryForeground);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--header-bg", batchTheme.headerBg);
    root.style.setProperty("--header-fg", batchTheme.headerFg);
    root.style.setProperty("--sidebar-background", batchTheme.sidebarBg);
    root.style.setProperty("--sidebar-foreground", batchTheme.sidebarFg);
    root.style.setProperty("--sidebar-accent", batchTheme.sidebarAccent);
    root.style.setProperty("--sidebar-accent-foreground", batchTheme.sidebarFg);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-primary-foreground", batchTheme.primaryForeground);
    root.style.setProperty("--sidebar-border", batchTheme.sidebarAccent);
    root.style.setProperty("--sidebar-ring", primary);
  }, [batchTheme, userAccent]);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  return (
    <ThemeContext.Provider
      value={{
        batchTheme, userAccent, setBatchTheme, setUserAccent,
        isAdmin, setIsAdmin, customThemes, addCustomTheme, removeCustomTheme,
      }}
    >
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage: `url("${batchTheme.pattern}")`,
          backgroundRepeat: "repeat",
          opacity: 0.6,
        }}
        aria-hidden="true"
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
