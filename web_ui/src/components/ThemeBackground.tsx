import { useThemeStore } from "@/stores/themeStore";

/** Renders the background pattern overlay. Mount once in App. */
export function ThemeBackground() {
  const batchTheme = useThemeStore((s) => s.batchTheme);
  const colorMode = useThemeStore((s) => s.colorMode);

  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        backgroundImage: `url("${batchTheme.pattern}")`,
        backgroundRepeat: "repeat",
        opacity: colorMode === "dark" ? 0.4 : 0.6,
      }}
      aria-hidden="true"
    />
  );
}
