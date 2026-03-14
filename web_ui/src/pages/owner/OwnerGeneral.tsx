import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { useSemesterStore } from "@/stores/semesterStore";
import { useUpdateClassroomTheme } from "@/hooks/use-theme";
import { apiFetch } from "@/services/api";
import { type Semester } from "@/services/admin";
import { batchThemes, primaryPresets, headerPresets, patternTemplates } from "@/lib/themes";
import type { BatchTheme } from "@/lib/themes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DatePicker } from "@/components/DatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  Plus,
  Send,
  Save,
  Download,
  Database,
  Users,
  MessageSquare,
  FolderOpen,
  Swords,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  CalendarDays,
  Pencil,
  Archive,
  Clock,
  Play,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ─── Custom Theme Creator ───

function hexToHsl(hex: string): string {
  const clean = hex.replace("#", "");
  const parsed = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const r = parseInt(parsed.slice(0, 2), 16) / 255;
  const g = parseInt(parsed.slice(2, 4), 16) / 255;
  const b = parseInt(parsed.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslWithLightness(hsl: string, lightness: number): string {
  const [h = "0", s = "0%"] = hsl.split(/\s+/);
  return `${h} ${s} ${lightness}%`;
}

function hexToEncoded(hex: string): string {
  return `%23${hex.replace("#", "")}`;
}

function CustomThemeCreator({ onCreated }: { onCreated: (theme: BatchTheme) => void }) {
  const [name, setName] = useState("");
  const [primaryIdx, setPrimaryIdx] = useState(0);
  const [headerIdx, setHeaderIdx] = useState(0);
  const [patternIdx, setPatternIdx] = useState(6);
  const [customPrimaryHex, setCustomPrimaryHex] = useState("#2563eb");
  const [customHeaderHex, setCustomHeaderHex] = useState("#1f2937");
  const [primarySource, setPrimarySource] = useState<"preset" | "custom">("preset");
  const [headerSource, setHeaderSource] = useState<"preset" | "custom">("preset");

  const handleCreate = () => {
    if (!name.trim()) return;
    const pPreset = primaryPresets[primaryIdx];
    const hPreset = headerPresets[headerIdx];
    const primaryHsl = primarySource === "custom" ? hexToHsl(customPrimaryHex) : pPreset.hsl;
    const headerHsl = headerSource === "custom" ? hexToHsl(customHeaderHex) : hPreset.hsl;
    const headerFg = headerSource === "custom" ? "0 0% 92%" : hPreset.fg;
    const pat = patternTemplates[patternIdx];

    const theme: BatchTheme = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      primary: primaryHsl,
      primaryForeground: "0 0% 100%",
      headerBg: headerHsl,
      headerFg: headerFg,
      sidebarBg: headerHsl,
      sidebarFg: headerFg,
      sidebarAccent: hslWithLightness(headerHsl, 24),
      pattern: pat.build(primarySource === "custom" ? hexToEncoded(customPrimaryHex) : pPreset.hex),
      isCustom: true,
    };

    setName("");
    onCreated(theme);
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
        <div className="flex flex-wrap gap-2 items-center">
          {primaryPresets.map((p, i) => (
            <Tooltip key={p.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setPrimaryIdx(i); setPrimarySource("preset"); }}
                  className={`w-9 h-9 border-2 transition-all ${i === primaryIdx && primarySource === "preset" ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: `hsl(${p.hsl})` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top"><span>{p.name}</span></TooltipContent>
            </Tooltip>
          ))}
          <label className={`w-9 h-9 border-2 cursor-pointer ${primarySource === "custom" ? "border-foreground scale-110" : "border-transparent"}`}>
            <input
              type="color"
              value={customPrimaryHex}
              onChange={(e) => { setCustomPrimaryHex(e.target.value); setPrimarySource("custom"); }}
              className="h-full w-full cursor-pointer p-0"
            />
          </label>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Header / Sidebar</label>
        <div className="flex flex-wrap gap-2 items-center">
          {headerPresets.map((h, i) => (
            <Tooltip key={h.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setHeaderIdx(i); setHeaderSource("preset"); }}
                  className={`w-9 h-9 border-2 transition-all ${i === headerIdx && headerSource === "preset" ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: `hsl(${h.hsl})` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top"><span>{h.name}</span></TooltipContent>
            </Tooltip>
          ))}
          <label className={`w-9 h-9 border-2 cursor-pointer ${headerSource === "custom" ? "border-foreground scale-110" : "border-transparent"}`}>
            <input
              type="color"
              value={customHeaderHex}
              onChange={(e) => { setCustomHeaderHex(e.target.value); setHeaderSource("custom"); }}
              className="h-full w-full cursor-pointer p-0"
            />
          </label>
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

// ─── Batch Theme Selector ───

function BatchThemeSelector() {
  const { batchTheme, setBatchTheme, customThemes, removeCustomTheme, addCustomTheme } = useTheme();
  const activeClassroom = useClassroomStore((s) => s.activeClassroom);
  const updateClassroomTheme = useUpdateClassroomTheme();
  const [showCreator, setShowCreator] = useState(false);
  const allThemes = [...batchThemes, ...customThemes];

  const persistThemeState = (activeTheme: BatchTheme, nextCustomThemes: BatchTheme[]) => {
    if (!activeClassroom) return;
    updateClassroomTheme.mutate({
      classroomId: activeClassroom.id,
      theme: {
        activeTheme,
        customThemes: nextCustomThemes,
      },
    });
  };

  const handleSelectTheme = (theme: BatchTheme) => {
    setBatchTheme(theme);
    persistThemeState(theme, customThemes);
  };

  const handleCreateTheme = (theme: BatchTheme) => {
    const nextCustomThemes = [...customThemes, theme];
    addCustomTheme(theme);
    setBatchTheme(theme);
    persistThemeState(theme, nextCustomThemes);
    setShowCreator(false);
  };

  const handleDeleteTheme = (theme: BatchTheme) => {
    const nextCustomThemes = customThemes.filter((t) => t.id !== theme.id);
    removeCustomTheme(theme.id);
    const fallbackTheme = batchTheme.id === theme.id ? batchThemes[6] : batchTheme;
    setBatchTheme(fallbackTheme);
    persistThemeState(fallbackTheme, nextCustomThemes);
  };

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
        {showCreator && <CustomThemeCreator onCreated={handleCreateTheme} />}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {allThemes.map((theme) => (
            <div key={theme.id} className="relative group">
              <button
                onClick={() => handleSelectTheme(theme)}
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
                      onClick={() => handleDeleteTheme(theme)}
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

// ─── Semester Management ───

const statusConfig = {
  active: { label: "Active", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  upcoming: { label: "Upcoming", icon: Clock, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  archived: { label: "Archived", icon: Archive, color: "bg-muted text-muted-foreground border-border" },
};

function SemesterFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Semester | null;
  onSave: (sem: any) => void;
  isLoading?: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [year, setYear] = useState(String(initial?.year || new Date().getFullYear()));
  const [startDate, setStartDate] = useState(initial?.startDate || "");
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [status, setStatus] = useState<Semester["status"]>(initial?.status || "upcoming");
  const [examStart, setExamStart] = useState(initial?.examPeriod?.start || "");
  const [examEnd, setExamEnd] = useState(initial?.examPeriod?.end || "");

  // Sync state with initial when it changes
  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setYear(String(initial.year));
      setStartDate(initial.startDate);
      setEndDate(initial.endDate);
      setStatus(initial.status);
      setExamStart(initial.examPeriod?.start || "");
      setExamEnd(initial.examPeriod?.end || "");
    } else {
      setName("");
      setYear(String(new Date().getFullYear()));
      setStartDate("");
      setEndDate("");
      setStatus("upcoming");
      setExamStart("");
      setExamEnd("");
    }
  }, [initial]);

  const isValid = name.trim() && startDate && endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">
            {initial ? "Edit Semester" : "Add Semester"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Semester Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall 2026" className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Year</label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as Semester["status"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Start Date</label>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">End Date</label>
              <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Exam Start</label>
              <DatePicker value={examStart} onChange={setExamStart} placeholder="Exam start" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Exam End</label>
              <DatePicker value={examEnd} onChange={setExamEnd} placeholder="Exam end" />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!isValid || isLoading}
              onClick={() => {
                onSave({
                  ...(initial?.id && { id: initial.id }),
                  name: name.trim(),
                  year: Number(year),
                  startDate,
                  endDate,
                  status,
                  examPeriod: examStart && examEnd ? { start: examStart, end: examEnd } : undefined,
                });
              }}
            >
              {isLoading ? (
                <div className="h-3 w-3 border-2 border-primary-foreground border-t-transparent animate-spin" />
              ) : initial ? (
                <><Pencil className="h-3 w-3" /> Save</>
              ) : (
                <><Plus className="h-3 w-3" /> Add</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SemesterManagement() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { semesters, activeSemester, setActiveSemester, addSemester, updateSemester, deleteSemester, reload, isLoading } = useSemesterStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);

  useEffect(() => {
    reload();
  }, []);

  const handleSave = async (sem: Semester) => {
    try {
      if (sem.id) {
        await updateSemester(sem);
        toast({ title: "Updated", description: `${sem.name} has been updated.` });
      } else {
        await addSemester(sem);
        toast({ title: "Created", description: `${sem.name} has been added.` });
      }
      setEditing(null);
      setFormOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSemester(id);
      toast({ title: "Deleted", description: "Semester removed successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSetActive = async (sem: Semester) => {
    setActiveSemester(sem);
    logout();
    navigate("/login");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider">Semesters</h3>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="h-8 text-[10px] font-bold uppercase tracking-widest">
          <Plus className="h-3 w-3" /> Add Semester
        </Button>
      </div>

      <div className="grid gap-3">
        {isLoading && semesters.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse border border-border" />
            ))}
          </div>
        ) : semesters.length === 0 ? (
          <div className="border border-dashed border-border p-8 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">No semesters defined</p>
          </div>
        ) : (
          semesters.map((sem) => {
            const config = statusConfig[sem.status];
            const StatusIcon = config.icon;
            const isActive = activeSemester?.id === sem.id;

            return (
              <Card key={sem.id} className={cn("overflow-hidden transition-all", isActive ? "border-primary/50 ring-1 ring-primary/20" : "hover:border-primary/30")}>
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row">
                    {/* Status Strip */}
                    <div className={cn("w-full sm:w-1.5", isActive ? "bg-primary" : "bg-border")} />
                    
                    <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold">{sem.name}</h4>
                          <span className={cn("px-1.5 py-0.5 border text-[9px] font-bold uppercase tracking-wider flex items-center gap-1", config.color)}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {config.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground font-medium">
                          <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {sem.startDate} — {sem.endDate}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Year {sem.year}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {!isActive && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase tracking-widest gap-1.5 border-primary/30 text-primary hover:bg-primary/5">
                                <Play className="h-3 w-3" /> Set Active
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="uppercase tracking-wider">Switch Active Semester?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">
                                  Are you sure you want to set <strong>{sem.name}</strong> as the active semester? 
                                  You will be logged out to apply this change system-wide.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="text-xs font-bold uppercase tracking-widest">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleSetActive(sem)} 
                                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold uppercase tracking-widest"
                                >
                                  Confirm & Logout
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(sem); setFormOpen(true); }} className="h-8 w-8 p-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="uppercase tracking-wider">Delete Semester?</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Are you sure you want to delete <strong>{sem.name}</strong>? This will remove all associated configurations.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="text-xs font-bold uppercase tracking-widest">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(sem.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-bold uppercase tracking-widest">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <SemesterFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSave={handleSave}
        isLoading={isLoading}
      />
    </div>
  );
}

// ─── Settings Tab ───

function SettingsTab() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { activeClassroom, setActiveClassroom, clearActiveClassroom } = useClassroomStore();
  const [telegramGroupId, setTelegramGroupId] = useState(activeClassroom?.telegramGroupId || "");
  const [savingTelegramGroupId, setSavingTelegramGroupId] = useState(false);

  useEffect(() => {
    setTelegramGroupId(activeClassroom?.telegramGroupId || "");
  }, [activeClassroom?.telegramGroupId]);

  const handleSaveTelegramGroupId = async () => {
    if (!activeClassroom) return;
    const trimmed = telegramGroupId.trim();
    if (!trimmed) {
      toast({ title: "Missing Group ID", description: "Telegram group ID is required.", variant: "destructive" });
      return;
    }
    if (!/^-?\d+$/.test(trimmed)) {
      toast({ title: "Invalid Format", description: "Telegram group IDs must be numbers (e.g. -100123456789).", variant: "destructive" });
      return;
    }

    setSavingTelegramGroupId(true);
    try {
      const updated = await apiFetch(`/classrooms/${activeClassroom.id}/telegram-group`, {
        method: "PUT",
        body: JSON.stringify({ telegramGroupId: trimmed }),
      });
      setActiveClassroom(updated);
      toast({ title: "Saved", description: "Telegram group ID updated successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingTelegramGroupId(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await apiFetch("/users/me", { method: "DELETE" });
      toast({ title: "Account Deleted", description: "Your account and all associated data have been removed." });
      clearActiveClassroom();
      logout();
      navigate("/login");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
     <div className="space-y-8">
       {/* Telegram Group Settings */}
       <div className="space-y-4">
         <div className="border-b border-border pb-2">
           <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">Integrations</p>
           <h2 className="text-sm font-black uppercase tracking-wider">Telegram Group</h2>
         </div>
         <Card>
           <CardHeader>
             <CardTitle className="text-xs">Telegram Group ID</CardTitle>
             <CardDescription className="text-[10px]">
               This is required for onboarding and can be updated any time here.
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-3">
             <Input
               value={telegramGroupId}
               onChange={(e) => setTelegramGroupId(e.target.value)}
               placeholder="e.g. -100123456789"
               className="font-mono text-sm"
             />
             <div className="flex justify-end">
               <Button size="sm" onClick={handleSaveTelegramGroupId} disabled={savingTelegramGroupId}>
                 {savingTelegramGroupId ? (
                   <div className="h-3 w-3 border-2 border-primary-foreground border-t-transparent animate-spin" />
                 ) : (
                   <>
                     <Save className="h-3 w-3" />
                     Save Group ID
                   </>
                 )}
               </Button>
             </div>
           </CardContent>
         </Card>
       </div>

       {/* Theme Settings */}
       <div className="space-y-4">
         <div className="border-b border-border pb-2">
           <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">Aesthetics</p>
           <h2 className="text-sm font-black uppercase tracking-wider">Classroom Theme</h2>
         </div>
         <BatchThemeSelector />
       </div>

       {/* Semester Management */}
       <div className="space-y-4">
         <div className="border-b border-border pb-2">
           <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">Academic Structure</p>
           <h2 className="text-sm font-black uppercase tracking-wider">Semesters & Periods</h2>
         </div>
         <SemesterManagement />
       </div>

      {/* Danger Zone */}
      <div className="space-y-4 pt-4">
        <div className="border-b border-border pb-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-destructive font-bold">Danger Zone</p>
          <h2 className="text-sm font-black uppercase tracking-wider text-destructive">Critical Actions</h2>
        </div>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-xs text-destructive flex items-center gap-2">
              <Trash2 className="h-3.5 w-3.5" />
              Delete Account
            </CardTitle>
            <CardDescription className="text-[10px] text-destructive/70">
              Permanently remove your account and all associated data. This action is irreversible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="text-[10px] font-black uppercase tracking-widest gap-2">
                  <AlertTriangle className="h-3 w-3" />
                  Wipe Everything & Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="uppercase tracking-wider">Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm">
                    This will permanently delete your user profile and remove you from all classrooms.
                    You will need to sign up and set your Telegram group ID again if you want to return.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="text-xs font-bold uppercase tracking-widest">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-bold uppercase tracking-widest"
                  >
                    Yes, Delete My Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
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
          <SettingsTab />
        </TabsContent>

        <TabsContent value="export">
          <DataExportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OwnerGeneral;
