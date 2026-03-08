import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFlaggedContent, type FlaggedContent } from "@/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert,
  MessageSquare,
  FolderOpen,
  Swords,
  CornerDownRight,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const typeIcons = {
  post: MessageSquare,
  resource: FolderOpen,
  quiz: Swords,
  reply: CornerDownRight,
};

const statusConfig = {
  pending: { label: "Pending", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock },
  resolved: { label: "Resolved", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  dismissed: { label: "Dismissed", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

const AdminModeration = () => {
  const { data: flaggedItems, isLoading } = useQuery({
    queryKey: ["flaggedContent"],
    queryFn: fetchFlaggedContent,
  });

  const [localChanges, setLocalChanges] = useState<Record<string, FlaggedContent["status"]>>({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    status: FlaggedContent["status"];
    label: string;
    description: string;
    destructive?: boolean;
  } | null>(null);

  const items = (flaggedItems || []).map((item) => ({
    ...item,
    status: localChanges[item.id] || item.status,
  }));

  const filtered = items.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterType !== "all" && item.type !== filterType) return false;
    return true;
  });

  const stats = {
    total: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    resolved: items.filter((i) => i.status === "resolved").length,
  };

  const updateStatus = (id: string, status: FlaggedContent["status"]) => {
    setLocalChanges((prev) => ({ ...prev, [id]: status }));
    toast({ title: status === "resolved" ? "Resolved" : "Dismissed", description: `Report has been ${status}.` });
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Admin</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Moderation</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Reports</p>
          <p className="text-2xl font-black tabular-nums mt-1">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-amber-600">Pending</p>
          <p className="text-2xl font-black tabular-nums mt-1">{stats.pending}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-emerald-600">Resolved</p>
          <p className="text-2xl font-black tabular-nums mt-1">{stats.resolved}</p>
        </CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="post">Posts</SelectItem>
            <SelectItem value="resource">Resources</SelectItem>
            <SelectItem value="quiz">Quizzes</SelectItem>
            <SelectItem value="reply">Replies</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-12 bg-muted animate-pulse" />
                <div className="h-4 w-20 bg-muted animate-pulse" />
                <div className="h-4 w-16 bg-muted animate-pulse" />
                <div className="flex-1" />
                <div className="h-3 w-16 bg-muted animate-pulse" />
              </div>
              <div className="h-4 w-3/4 bg-muted animate-pulse" />
              <div className="flex justify-between">
                <div className="h-3 w-40 bg-muted animate-pulse" />
                <div className="flex gap-1">
                  <div className="h-6 w-24 bg-muted animate-pulse" />
                  <div className="h-6 w-16 bg-muted animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const TypeIcon = typeIcons[item.type];
            const sCfg = statusConfig[item.status];
            const SIcon = sCfg.icon;
            return (
              <div key={item.id} className="border border-border p-4 space-y-2 hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-1.5 py-0.5 border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <TypeIcon className="h-2.5 w-2.5" /> {item.type}
                  </span>
                  <span className="px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive border-destructive/30">
                    {item.reason}
                  </span>
                  <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1", sCfg.color)}>
                    <SIcon className="h-2.5 w-2.5" /> {sCfg.label}
                  </span>
                  <div className="flex-1" />
                  <span className="text-[10px] text-muted-foreground">{new Date(item.reportedAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm">{item.content}</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>By: {item.author} · Reported by: {item.reportedBy}</span>
                  {item.status === "pending" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => {
                        setConfirmAction({ id: item.id, status: "resolved", label: "Remove Content", description: "This content will be permanently removed from the platform.", destructive: true });
                      }}>
                        <Trash2 className="h-2.5 w-2.5" /> Remove Content
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => {
                        setConfirmAction({ id: item.id, status: "dismissed", label: "Dismiss Report", description: "This report will be dismissed and the content will remain." });
                      }}>
                        <XCircle className="h-2.5 w-2.5" /> Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (confirmAction) {
                  updateStatus(confirmAction.id, confirmAction.status);
                  setConfirmAction(null);
                }
              }}
            >
              {confirmAction?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminModeration;
