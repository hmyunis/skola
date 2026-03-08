import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  batchThemes,
  type BatchTheme,
  type UserAccent,
  type ColorMode,
  parseHueSat,
  generateSurfaceColors,
} from "@/lib/themes";

export const FONT_FAMILIES = [
  { id: "system", name: "System Default", value: "ui-sans-serif, system-ui, sans-serif" },
  { id: "inter", name: "Inter", value: "'Inter', sans-serif" },
  { id: "dm-sans", name: "DM Sans", value: "'DM Sans', sans-serif" },
  { id: "space-grotesk", name: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
  { id: "jetbrains", name: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
  { id: "playfair", name: "Playfair Display", value: "'Playfair Display', serif" },
  { id: "outfit", name: "Outfit", value: "'Outfit', sans-serif" },
  { id: "sora", name: "Sora", value: "'Sora', sans-serif" },
  { id: "manrope", name: "Manrope", value: "'Manrope', sans-serif" },
  { id: "ibm-plex", name: "IBM Plex Sans", value: "'IBM Plex Sans', sans-serif" },
];

interface ThemeContextType {
  batchTheme: BatchTheme;
  userAccent: UserAccent | null;
  colorMode: ColorMode;
  fontFamily: string;
  setBatchTheme: (theme: BatchTheme) => void;
  setUserAccent: (accent: UserAccent | null) => void;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
  setFontFamily: (id: string) => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  customThemes: BatchTheme[];
  addCustomTheme: (theme: BatchTheme) => void;
  removeCustomTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const CUSTOM_THEMES_KEY = "scola-custom-themes";
const COLOR_MODE_KEY = "scola-color-mode";
const FONT_FAMILY_KEY = "scola-font-family";

function loadCustomThemes(): BatchTheme[] {
  try {
    const stored = localStorage.getItem(CUSTOM_THEMES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function loadColorMode(): ColorMode {
  try {
    const stored = localStorage.getItem(COLOR_MODE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  // Respect system preference
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [batchTheme, setBatchTheme] = useState<BatchTheme>(batchThemes[6]);
  const [userAccent, setUserAccent] = useState<UserAccent | null>(null);
  const [isAdmin, setIsAdmin] = useState(true);
  const [customThemes, setCustomThemes] = useState<BatchTheme[]>(loadCustomThemes);
  const [colorMode, setColorModeState] = useState<ColorMode>(loadColorMode);
  const [fontFamily, setFontFamilyState] = useState<string>(() => {
    try { return localStorage.getItem(FONT_FAMILY_KEY) || "system"; } catch { return "system"; }
  });

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    localStorage.setItem(COLOR_MODE_KEY, mode);
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorMode(colorMode === "light" ? "dark" : "light");
  }, [colorMode, setColorMode]);

  const setFontFamily = useCallback((id: string) => {
    setFontFamilyState(id);
    localStorage.setItem(FONT_FAMILY_KEY, id);
    const font = FONT_FAMILIES.find(f => f.id === id);
    if (font) document.documentElement.style.setProperty("font-family", font.value);
  }, []);

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
    setBatchTheme((current) => (current.id === id ? batchThemes[6] : current));
  }, []);

  const applyTheme = useCallback(() => {
    const root = document.documentElement;
    const isDark = colorMode === "dark";

    // Toggle dark class
    root.classList.toggle("dark", isDark);

    // Primary colors
    const primary = userAccent ? userAccent.hsl : batchTheme.primary;
    const primaryForDark = isDark ? adjustPrimaryForDark(primary) : primary;

    root.style.setProperty("--primary", primaryForDark);
    root.style.setProperty("--primary-foreground", batchTheme.primaryForeground);
    root.style.setProperty("--ring", primaryForDark);

    // Header/sidebar (these stay dark-toned in both modes, just subtly adjusted)
    root.style.setProperty("--header-bg", batchTheme.headerBg);
    root.style.setProperty("--header-fg", batchTheme.headerFg);
    root.style.setProperty("--sidebar-background", batchTheme.sidebarBg);
    root.style.setProperty("--sidebar-foreground", batchTheme.sidebarFg);
    root.style.setProperty("--sidebar-accent", batchTheme.sidebarAccent);
    root.style.setProperty("--sidebar-accent-foreground", batchTheme.sidebarFg);
    root.style.setProperty("--sidebar-primary", primaryForDark);
    root.style.setProperty("--sidebar-primary-foreground", batchTheme.primaryForeground);
    root.style.setProperty("--sidebar-border", batchTheme.sidebarAccent);
    root.style.setProperty("--sidebar-ring", primaryForDark);

    // Surface colors — derived from theme hue + mode
    const [hue, sat] = parseHueSat(batchTheme.primary);
    const surfaceVars = generateSurfaceColors(hue, sat, isDark);
    for (const [key, value] of Object.entries(surfaceVars)) {
      root.style.setProperty(key, value);
    }
  }, [batchTheme, userAccent, colorMode]);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  return (
    <ThemeContext.Provider
      value={{
        batchTheme, userAccent, colorMode,
        setBatchTheme, setUserAccent, toggleColorMode, setColorMode,
        isAdmin, setIsAdmin, customThemes, addCustomTheme, removeCustomTheme,
      }}
    >
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage: `url("${batchTheme.pattern}")`,
          backgroundRepeat: "repeat",
          opacity: colorMode === "dark" ? 0.4 : 0.6,
        }}
        aria-hidden="true"
      />
      {children}
    </ThemeContext.Provider>
  );
}

// Boost lightness of primary in dark mode for better visibility
function adjustPrimaryForDark(hsl: string): string {
  const parts = hsl.split(/\s+/);
  if (parts.length < 3) return hsl;
  const h = parts[0];
  const s = parts[1];
  const l = parseFloat(parts[2]);
  // Boost lightness to at least 55% for dark backgrounds
  const newL = Math.max(l, 55);
  return `${h} ${s} ${newL}%`;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
