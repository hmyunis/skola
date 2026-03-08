import { useTheme } from "@/contexts/ThemeContext";
import { batchThemes, userAccents } from "@/lib/themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

const SettingsPage = () => {
  const { batchTheme, setBatchTheme, userAccent, setUserAccent, isAdmin, setIsAdmin } = useTheme();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Configuration</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Settings</h1>
      </div>

      {/* Batch Theme selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs">Batch Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {batchThemes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setBatchTheme(theme)}
                className={`p-3 border text-left text-xs font-bold uppercase tracking-wider transition-colors ${
                  batchTheme.id === theme.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent text-foreground"
                }`}
              >
                {theme.name}
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
                !userAccent
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent text-foreground"
              }`}
            >
              Default
            </button>
            {userAccents.map((accent) => (
              <button
                key={accent.id}
                onClick={() => setUserAccent(accent)}
                className={`px-4 py-2 border text-xs font-bold uppercase tracking-wider transition-colors ${
                  userAccent?.id === accent.id
                    ? "border-2"
                    : "border-border hover:bg-accent"
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

      {/* Admin toggle (for demo) */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-xs">Demo Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm font-medium uppercase tracking-wide">Admin Mode</span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
