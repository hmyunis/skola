import { useState } from "react";
import { useTheme, FONT_FAMILIES } from "@/stores/themeStore";
import { useAuth } from "@/stores/authStore";
import { batchThemes, userAccents, primaryPresets, headerPresets, patternTemplates } from "@/lib/themes";
import type { BatchTheme } from "@/lib/themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Type } from "lucide-react";

const SettingsPage = () => {
  const {
    userAccent, setUserAccent,
    colorMode, setColorMode, fontFamily, setFontFamily,
  } = useTheme();

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
