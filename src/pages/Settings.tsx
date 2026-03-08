import { useState } from "react";
import { useTheme, FONT_FAMILIES } from "@/stores/themeStore";
import { useAuth } from "@/stores/authStore";
import { batchThemes, userAccents, primaryPresets, headerPresets, patternTemplates } from "@/lib/themes";
import type { BatchTheme } from "@/lib/themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus, Sun, Moon, Type, Send, Save } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

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
            <Tooltip key={p.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setPrimaryIdx(i)}
                  className={`w-9 h-9 border-2 transition-all ${i === primaryIdx ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: `hsl(${p.hsl})` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top"><span>{p.name}</span></TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Header / Sidebar</label>
        <div className="flex flex-wrap gap-2">
          {headerPresets.map((h, i) => (
            <Tooltip key={h.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setHeaderIdx(i)}
                  className={`w-9 h-9 border-2 transition-all ${i === headerIdx ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: `hsl(${h.hsl})` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top"><span>{h.name}</span></TooltipContent>
            </Tooltip>
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
    customThemes, removeCustomTheme,
    colorMode, setColorMode, fontFamily, setFontFamily,
  } = useTheme();
  const { isOwner } = useAuth();
  const [showCreator, setShowCreator] = useState(false);

  const allThemes = [...batchThemes, ...customThemes];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Configuration</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Appearance</h1>
      </div>

      {/* Appearance Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs">Color Mode</CardTitle>
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

      {/* Font Family */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs flex items-center gap-2">
            <Type className="h-3.5 w-3.5" />
            Font Family
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {FONT_FAMILIES.map((font) => (
              <button
                key={font.id}
                onClick={() => setFontFamily(font.id)}
                className={`p-3 border text-left transition-colors ${
                  fontFamily === font.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent text-foreground"
                }`}
                style={{ fontFamily: font.value }}
              >
                <span className="text-sm font-semibold block">{font.name}</span>
                <span className="text-[10px] text-muted-foreground mt-1 block">Aa Bb Cc 123</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Batch Theme selector — Owner only */}
      {isOwner && (
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => removeCustomTheme(theme.id)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top"><span>Delete</span></TooltipContent>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Telegram Group ID — Owner only */}
      {isOwner && <TelegramGroupIdSetting />}

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
    </div>
  );
};

export default SettingsPage;
