import { create } from "zustand";
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

const CUSTOM_THEMES_KEY = "skola-custom-themes";
const COLOR_MODE_KEY = "skola-color-mode";
const FONT_FAMILY_KEY = "skola-font-family";

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
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function loadFontFamily(): string {
  try {
    return localStorage.getItem(FONT_FAMILY_KEY) || "system";
  } catch {
    return "system";
  }
}

function adjustPrimaryForDark(hsl: string): string {
  const parts = hsl.split(/\s+/);
  if (parts.length < 3) return hsl;
  const h = parts[0];
  const s = parts[1];
  const l = parseFloat(parts[2]);
  const newL = Math.max(l, 55);
  return `${h} ${s} ${newL}%`;
}

function applyThemeToDOM(batchTheme: BatchTheme, userAccent: UserAccent | null, colorMode: ColorMode) {
  const root = document.documentElement;
  const isDark = colorMode === "dark";
  root.classList.toggle("dark", isDark);

  const primary = userAccent ? userAccent.hsl : batchTheme.primary;
  const primaryForDark = isDark ? adjustPrimaryForDark(primary) : primary;

  root.style.setProperty("--primary", primaryForDark);
  root.style.setProperty("--primary-foreground", batchTheme.primaryForeground);
  root.style.setProperty("--ring", primaryForDark);

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

  const [hue, sat] = parseHueSat(batchTheme.primary);
  const surfaceVars = generateSurfaceColors(hue, sat, isDark);
  for (const [key, value] of Object.entries(surfaceVars)) {
    root.style.setProperty(key, value);
  }
}

function applyFontToDOM(fontId: string) {
  const font = FONT_FAMILIES.find((f) => f.id === fontId);
  if (font) document.documentElement.style.setProperty("--font-family", font.value);
}

interface ThemeState {
  batchTheme: BatchTheme;
  userAccent: UserAccent | null;
  colorMode: ColorMode;
  fontFamily: string;
  customThemes: BatchTheme[];

  setBatchTheme: (theme: BatchTheme) => void;
  setUserAccent: (accent: UserAccent | null) => void;
  setColorMode: (mode: ColorMode) => void;
  toggleColorMode: () => void;
  setFontFamily: (id: string) => void;
  addCustomTheme: (theme: BatchTheme) => void;
  removeCustomTheme: (id: string) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialColorMode = loadColorMode();
  const initialBatch = batchThemes[6];
  const initialFont = loadFontFamily();

  // Apply on store creation
  applyThemeToDOM(initialBatch, null, initialColorMode);
  applyFontToDOM(initialFont);

  return {
    batchTheme: initialBatch,
    userAccent: null,
    colorMode: initialColorMode,
    fontFamily: initialFont,
    customThemes: loadCustomThemes(),

    setBatchTheme: (theme) => {
      set({ batchTheme: theme });
      const { userAccent, colorMode } = get();
      applyThemeToDOM(theme, userAccent, colorMode);
    },

    setUserAccent: (accent) => {
      set({ userAccent: accent });
      const { batchTheme, colorMode } = get();
      applyThemeToDOM(batchTheme, accent, colorMode);
    },

    setColorMode: (mode) => {
      localStorage.setItem(COLOR_MODE_KEY, mode);
      set({ colorMode: mode });
      const { batchTheme, userAccent } = get();
      applyThemeToDOM(batchTheme, userAccent, mode);
    },

    toggleColorMode: () => {
      const next = get().colorMode === "light" ? "dark" : "light";
      get().setColorMode(next);
    },

    setFontFamily: (id) => {
      localStorage.setItem(FONT_FAMILY_KEY, id);
      set({ fontFamily: id });
      applyFontToDOM(id);
    },

    addCustomTheme: (theme) => {
      const next = [...get().customThemes, { ...theme, isCustom: true }];
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next));
      set({ customThemes: next });
    },

    removeCustomTheme: (id) => {
      const next = get().customThemes.filter((t) => t.id !== id);
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(next));
      set({ customThemes: next });
      if (get().batchTheme.id === id) {
        get().setBatchTheme(batchThemes[6]);
      }
    },
  };
});

// Convenience hook matching old API
export const useTheme = () => useThemeStore();
