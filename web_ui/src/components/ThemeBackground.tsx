import { useThemeStore } from "@/stores/themeStore";

/** Renders the background pattern overlay. Mount once in App. */
export function ThemeBackground() {
  const batchTheme = useThemeStore((s) => s.batchTheme);
  const colorMode = useThemeStore((s) => s.colorMode);
  const isDark = colorMode === "dark";
  const rawIntensity =
    typeof batchTheme.patternIntensity === "number"
      ? batchTheme.patternIntensity
      : 0.25;
  const intensity = Math.max(0, Math.min(1, rawIntensity));

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("${batchTheme.pattern}")`,
          backgroundRepeat: "repeat",
          opacity: (isDark ? 0.78 : 0.86) * intensity,
          mixBlendMode: isDark ? "screen" : "multiply",
          filter: isDark
            ? "contrast(1.5) saturate(1.35) brightness(1.4)"
            : "contrast(1.2) saturate(1.08)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: isDark
            ? "hsl(var(--foreground) / 0.24)"
            : "hsl(var(--foreground) / 0.12)",
          WebkitMaskImage: `url("${batchTheme.pattern}")`,
          WebkitMaskRepeat: "repeat",
          WebkitMaskPosition: "top left",
          maskImage: `url("${batchTheme.pattern}")`,
          maskRepeat: "repeat",
          maskPosition: "top left",
          opacity: (isDark ? 0.9 : 0.75) * intensity,
        }}
      />
    </div>
  );
}
