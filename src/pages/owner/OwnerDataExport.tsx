import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Download,
  Database,
  Users,
  MessageSquare,
  FolderOpen,
  Swords,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const exportItems = [
  { id: "users", label: "Users & Profiles", icon: Users, description: "All user accounts, roles, and profile data", estimatedSize: "~2.4 MB" },
  { id: "posts", label: "Lounge Posts & Replies", icon: MessageSquare, description: "All lounge posts, replies, and reactions", estimatedSize: "~8.1 MB" },
  { id: "resources", label: "Resource Metadata", icon: FolderOpen, description: "All resource entries (metadata only, no files)", estimatedSize: "~1.2 MB" },
  { id: "quizzes", label: "Quiz Data", icon: Swords, description: "All custom quizzes and leaderboard data", estimatedSize: "~3.5 MB" },
  { id: "analytics", label: "Analytics Logs", icon: Database, description: "Activity logs and engagement metrics", estimatedSize: "~12.8 MB" },
];

const OwnerDataExport = () => {
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
    // Simulate export
    for (const id of selected) {
      await new Promise((r) => setTimeout(r, 800));
      setExportedItems((prev) => new Set([...prev, id]));
    }
    setExporting(false);
    toast({ title: "Export Complete", description: `${selected.size} dataset(s) exported successfully.` });
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Owner</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Data Export</h1>
        <p className="text-xs text-muted-foreground mt-1">Export platform data for backup or migration</p>
      </div>

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
};

export default OwnerDataExport;
