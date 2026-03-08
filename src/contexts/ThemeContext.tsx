import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { batchThemes, userAccents, type BatchTheme, type UserAccent } from "@/lib/themes";

interface ThemeContextType {
  batchTheme: BatchTheme;
  userAccent: UserAccent | null;
  setBatchTheme: (theme: BatchTheme) => void;
  setUserAccent: (accent: UserAccent | null) => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [batchTheme, setBatchTheme] = useState<BatchTheme>(batchThemes[6]); // Architecture default
  const [userAccent, setUserAccent] = useState<UserAccent | null>(null);
  const [isAdmin, setIsAdmin] = useState(true); // Default admin for demo

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
      value={{ batchTheme, userAccent, setBatchTheme, setUserAccent, isAdmin, setIsAdmin }}
    >
      {/* SVG pattern background layer */}
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
