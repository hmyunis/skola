import { useState } from "react";
import {
  loadFeatures,
  saveFeatures,
  type FeatureToggle,
} from "@/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  ToggleLeft,
  Layers,
  MessageSquare,
  Gamepad2,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const categoryConfig = {
  core: { label: "Core", icon: Layers, color: "text-primary" },
  social: { label: "Social", icon: MessageSquare, color: "text-sky-500" },
  gamification: { label: "Gamification", icon: Gamepad2, color: "text-amber-500" },
  experimental: { label: "Experimental", icon: FlaskConical, color: "text-violet-500" },
};

const OwnerFeatures = () => {
  const [features, setFeatures] = useState<FeatureToggle[]>(loadFeatures);

  const toggleFeature = (id: string) => {
    const updated = features.map((f) =>
      f.id === id ? { ...f, enabled: !f.enabled } : f
    );
    setFeatures(updated);
    saveFeatures(updated);
    const ft = updated.find((f) => f.id === id)!;
    toast({
      title: ft.enabled ? "Enabled" : "Disabled",
      description: `${ft.name} has been ${ft.enabled ? "enabled" : "disabled"}.`,
    });
  };

  const grouped = Object.entries(categoryConfig).map(([key, cfg]) => ({
    ...cfg,
    key,
    features: features.filter((f) => f.category === key),
  }));

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Owner</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Feature Toggles</h1>
        <p className="text-xs text-muted-foreground mt-1">Enable or disable platform features globally</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Features</p>
          <p className="text-2xl font-black tabular-nums mt-1">{features.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-emerald-600">Active</p>
          <p className="text-2xl font-black tabular-nums mt-1">{features.filter((f) => f.enabled).length}</p>
        </CardContent></Card>
      </div>

      {grouped.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <GroupIcon className={cn("h-4 w-4", group.color)} />
              <h2 className="text-sm font-bold uppercase tracking-wider">{group.label}</h2>
            </div>
            <div className="space-y-1">
              {group.features.map((ft) => (
                <div
                  key={ft.id}
                  className={cn(
                    "border p-3 flex items-center gap-3 transition-colors",
                    ft.enabled ? "border-border" : "border-border bg-muted/50 opacity-60"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold">{ft.name}</p>
                    <p className="text-[10px] text-muted-foreground">{ft.description}</p>
                  </div>
                  <Switch
                    checked={ft.enabled}
                    onCheckedChange={() => toggleFeature(ft.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OwnerFeatures;
