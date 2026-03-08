import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { batchThemes, userAccents, primaryPresets, headerPresets, patternTemplates } from "@/lib/themes";
import type { BatchTheme } from "@/lib/themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus, Sun, Moon } from "lucide-react";

function CustomThemeCreator({ onCreated }: { onCreated: () => void }) {
  const { addCustomTheme } = useTheme();
  const [name, setName] = useState("");
  const [primaryIdx, setPrimaryIdx] = useState(0);
  const [headerIdx, setHeaderIdx] = useState(0);
  const [patternIdx, setPatternIdx] = useState(6);

  const handleCreate = () => {
    if (!name.trim()) return;
    const p = primaryPresets[primaryIdx];
    const h = headerPresets[headerIdx];
    const pat = patternTemplates[patternIdx];

    const theme: BatchTheme = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      primary: p.hsl,
      primaryForeground: "0 0% 100%",
      headerBg: h.hsl,
      headerFg: h.fg,
      sidebarBg: h.hsl,
      sidebarFg: h.fg,
      sidebarAccent: h.hsl.replace(/(\d+)%\s*$/, (_, l) => `${Math.min(100, parseInt(l) + 6)}%`),
      pattern: pat.build(p.hex),
      isCustom: true,
    };

    addCustomTheme(theme);
    setName("");
    onCreated();
  };

  return (
    <div className="space-y-4 border border-dashed border-primary/40 p-4">
      <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">New Custom Theme</p>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cyberpunk" className="max-w-xs" />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Primary Color</label>
        <div className="flex flex-wrap gap-2">
          {primaryPresets.map((p, i) => (
            <button
              key={p.name}
              onClick={() => setPrimaryIdx(i)}
              className={`w-9 h-9 border-2 transition-all ${i === primaryIdx ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ backgroundColor: `hsl(${p.hsl})` }}
              title={p.name}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Header / Sidebar</label>
        <div className="flex flex-wrap gap-2">
          {headerPresets.map((h, i) => (
            <button
              key={h.name}
              onClick={() => setHeaderIdx(i)}
              className={`w-9 h-9 border-2 transition-all ${i === headerIdx ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ backgroundColor: `hsl(${h.hsl})` }}
              title={h.name}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Pattern</label>
        <div className="flex flex-wrap gap-2">
          {patternTemplates.map((pat, i) => (
            <button
              key={pat.id}
              onClick={() => setPatternIdx(i)}
              className={`px-3 py-1.5 border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                i === patternIdx ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent text-foreground"
              }`}
            >
              {pat.name}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleCreate} disabled={!name.trim()} size="sm">
        <Plus className="h-3 w-3" />
        Create Theme
      </Button>
    </div>
  );
}

const SettingsPage = () => {
  const {
    batchTheme, setBatchTheme, userAccent, setUserAccent,
    isAdmin, setIsAdmin, customThemes, removeCustomTheme,
    colorMode, setColorMode,
  } = useTheme();
  const [showCreator, setShowCreator] = useState(false);

  const allThemes = [...batchThemes, ...customThemes];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Configuration</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Settings</h1>
      </div>

      {/* Appearance Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <button
              onClick={() => setColorMode("light")}
              className={`flex items-center gap-2 px-4 py-2.5 border text-xs font-bold uppercase tracking-wider transition-colors ${
                colorMode === "light"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent text-foreground"
              }`}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button
              onClick={() => setColorMode("dark")}
              className={`flex items-center gap-2 px-4 py-2.5 border text-xs font-bold uppercase tracking-wider transition-colors ${
                colorMode === "dark"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent text-foreground"
              }`}
            >
              <Moon className="h-4 w-4" />
              Dark
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Batch Theme selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs">Batch Theme</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowCreator(!showCreator)}>
              {showCreator ? "Cancel" : <><Plus className="h-3 w-3" /> Custom</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCreator && <CustomThemeCreator onCreated={() => setShowCreator(false)} />}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {allThemes.map((theme) => (
              <div key={theme.id} className="relative group">
                <button
                  onClick={() => setBatchTheme(theme)}
                  className={`w-full p-3 border text-left text-xs font-bold uppercase tracking-wider transition-colors ${
                    batchTheme.id === theme.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent text-foreground"
                  } ${theme.isCustom ? "border-dashed" : ""}`}
                >
                  {theme.name}
                  {theme.isCustom && <span className="block text-[9px] font-normal tracking-normal opacity-60 mt-0.5">Custom</span>}
                </button>
                {theme.isCustom && (
                  <button
                    onClick={() => removeCustomTheme(theme.id)}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Accent selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs">User Accent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setUserAccent(null)}
              className={`px-4 py-2 border text-xs font-bold uppercase tracking-wider transition-colors ${
                !userAccent ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent text-foreground"
              }`}
            >
              Default
            </button>
            {userAccents.map((accent) => (
              <button
                key={accent.id}
                onClick={() => setUserAccent(accent)}
                className={`px-4 py-2 border text-xs font-bold uppercase tracking-wider transition-colors ${
                  userAccent?.id === accent.id ? "border-2" : "border-border hover:bg-accent"
                }`}
                style={{
                  color: `hsl(${accent.hsl})`,
                  borderColor: userAccent?.id === accent.id ? `hsl(${accent.hsl})` : undefined,
                }}
              >
                {accent.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admin toggle */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-xs">Demo Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="h-4 w-4 accent-primary" />
            <span className="text-sm font-medium uppercase tracking-wide">Admin Mode</span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
