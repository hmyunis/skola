import { useState } from "react";
import { useTheme } from "@/stores/themeStore";
import { batchThemes, primaryPresets, headerPresets, patternTemplates } from "@/lib/themes";
import type { BatchTheme } from "@/lib/themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { X, Plus, Send, Save, Download, Database, Users, MessageSquare, FolderOpen, Swords, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─── Custom Theme Creator ───

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

// ─── Telegram Group ID Setting ───

const TELEGRAM_GROUP_ID_KEY = "skola-telegram-group-id";

function TelegramGroupIdSetting() {
  const [groupId, setGroupId] = useState(() => localStorage.getItem(TELEGRAM_GROUP_ID_KEY) || "");
  const [saved, setSaved] = useState(groupId);

  const handleSave = () => {
    localStorage.setItem(TELEGRAM_GROUP_ID_KEY, groupId.trim());
    setSaved(groupId.trim());
    toast({ title: "Saved", description: "Telegram Group ID updated." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs flex items-center gap-2">
          <Send className="h-3.5 w-3.5" />
          Telegram Group ID
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Only users who are members of this Telegram group will be able to log in.
          Your bot must be an admin in the group.
        </p>
        <div className="flex gap-2">
          <Input
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            placeholder="e.g. -1001234567890"
            className="max-w-xs h-9 text-sm font-mono"
          />
          <Button size="sm" onClick={handleSave} disabled={groupId.trim() === saved}>
            <Save className="h-3 w-3" />
            Save
          </Button>
        </div>
        {saved && (
          <p className="text-[10px] text-muted-foreground">
            Current: <code className="font-mono font-bold text-foreground">{saved}</code>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Batch Theme Selector ───

function BatchThemeSelector() {
  const { batchTheme, setBatchTheme, customThemes, removeCustomTheme } = useTheme();
  const [showCreator, setShowCreator] = useState(false);
  const allThemes = [...batchThemes, ...customThemes];

  return (
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
  );
}

// ─── Data Export Tab ───

const exportItems = [
  { id: "users", label: "Users & Profiles", icon: Users, description: "All user accounts, roles, and profile data", estimatedSize: "~2.4 MB" },
  { id: "posts", label: "Lounge Posts & Replies", icon: MessageSquare, description: "All lounge posts, replies, and reactions", estimatedSize: "~8.1 MB" },
  { id: "resources", label: "Resource Metadata", icon: FolderOpen, description: "All resource entries (metadata only, no files)", estimatedSize: "~1.2 MB" },
  { id: "quizzes", label: "Quiz Data", icon: Swords, description: "All custom quizzes and leaderboard data", estimatedSize: "~3.5 MB" },
  { id: "analytics", label: "Analytics Logs", icon: Database, description: "Activity logs and engagement metrics", estimatedSize: "~12.8 MB" },
];

function DataExportTab() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportedItems, setExportedItems] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === exportItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(exportItems.map((i) => i.id)));
    }
  };

  const handleExport = async () => {
    setConfirmOpen(false);
    setExporting(true);
    for (const id of selected) {
      await new Promise((r) => setTimeout(r, 800));
      setExportedItems((prev) => new Set([...prev, id]));
    }
    setExporting(false);
    toast({ title: "Export Complete", description: `${selected.size} dataset(s) exported successfully.` });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="text-xs" onClick={selectAll}>
          {selected.size === exportItems.length ? "Deselect All" : "Select All"}
        </Button>
        <Button
          size="sm"
          disabled={selected.size === 0 || exporting}
          onClick={() => setConfirmOpen(true)}
        >
          <Download className="h-3 w-3" />
          Export {selected.size > 0 ? `(${selected.size})` : ""}
        </Button>
      </div>

      <div className="space-y-2">
        {exportItems.map((item) => {
          const Icon = item.icon;
          const isSelected = selected.has(item.id);
          const isExported = exportedItems.has(item.id);
          return (
            <button
              key={item.id}
              onClick={() => toggleSelect(item.id)}
              className={cn(
                "w-full text-left border p-4 flex items-center gap-3 transition-colors",
                isSelected ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent/20"
              )}
            >
              <div className={cn("p-2 border", isSelected ? "bg-primary/10 border-primary/30" : "bg-muted border-border")}>
                <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.description}</p>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{item.estimatedSize}</span>
              {isExported && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
            </button>
          );
        })}
      </div>

      {exporting && (
        <div className="border border-primary/30 bg-primary/5 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider">Exporting...</p>
          <div className="space-y-1">
            {exportItems.filter((i) => selected.has(i.id)).map((item) => {
              const done = exportedItems.has(item.id);
              return (
                <div key={item.id} className="flex items-center gap-2 text-xs">
                  {done ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <div className="h-3 w-3 border border-primary/50 animate-spin" />
                  )}
                  <span className={cn(done ? "text-muted-foreground" : "text-foreground")}>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Export</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to export {selected.size} dataset(s). This may take a moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExport}>Export</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Page ───

const OwnerGeneral = () => {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Owner</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">General</h1>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="export">Data Export</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <TelegramGroupIdSetting />
          <BatchThemeSelector />
        </TabsContent>

        <TabsContent value="export">
          <DataExportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OwnerGeneral;
