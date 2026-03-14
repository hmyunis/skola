import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dismissArenaReport,
  dismissResourceReport,
  dismissLoungeReport,
  fetchAllFlaggedContent,
  resolveArenaReport,
  resolveLoungeReport,
  resolveResourceReport,
  updateUserReportStatus,
  type FlaggedContent,
} from "@/services/admin";
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
  MessageSquare,
  FolderOpen,
  Swords,
  CornerDownRight,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ShieldAlert,
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
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "resolved" | "dismissed">("all");
  const [filterType, setFilterType] = useState<"all" | "post" | "resource" | "quiz" | "reply">("all");
  const [confirmAction, setConfirmAction] = useState<{
    item: FlaggedContent;
    status: "resolved" | "dismissed";
    removeResource?: boolean;
    label: string;
    description: string;
    destructive?: boolean;
  } | null>(null);

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ["flaggedContent", { status: filterStatus, type: filterType }],
    queryFn: () => fetchAllFlaggedContent({ status: filterStatus, type: filterType }),
  });

  const items = allItems;

  const stats = useMemo(
    () => ({
      total: allItems.length,
      pending: allItems.filter((r) => r.status === "pending").length,
      resolved: allItems.filter((r) => r.status === "resolved").length,
    }),
    [allItems],
  );

  const actionMutation = useMutation({
    mutationFn: async (action: { item: FlaggedContent; status: "resolved" | "dismissed"; removeResource?: boolean }) => {
      if (action.item.type === "resource") {
        if (action.status === "resolved") {
          return resolveResourceReport(action.item.id, Boolean(action.removeResource));
        }
        return dismissResourceReport(action.item.id);
      }
      if (action.item.type === "post" || action.item.type === "reply") {
        if (action.status === "resolved") {
          return resolveLoungeReport(action.item.id, Boolean(action.removeResource));
        }
        return dismissLoungeReport(action.item.id);
      }
      if (action.item.type === "quiz") {
        if (action.status === "resolved") {
          return resolveArenaReport(action.item.id, Boolean(action.removeResource));
        }
        return dismissArenaReport(action.item.id);
      }
      updateUserReportStatus(action.item.id, action.status);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flaggedContent"] });
      toast({ title: "Moderation action applied" });
      setConfirmAction(null);
    },
    onError: (err: unknown) => {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Could not update report",
        variant: "destructive",
      });
    },
  });

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
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
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
              <div className="h-4 w-24 bg-muted animate-pulse" />
              <div className="h-3 w-3/4 bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center space-y-2">
          <ShieldAlert className="h-7 w-7 mx-auto text-muted-foreground" />
          <p className="text-sm uppercase tracking-wider text-muted-foreground">No reports found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const TypeIcon = typeIcons[item.type];
            const sCfg = statusConfig[item.status];
            const SIcon = sCfg.icon;
            const isRemovableContent = item.type === "resource" || item.type === "quiz" || item.type === "post" || item.type === "reply";

            return (
              <div key={item.id} className="border border-border p-3 sm:p-4 space-y-2 hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="px-1.5 py-0.5 border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <TypeIcon className="h-2.5 w-2.5" /> {item.type}
                  </span>
                  <span className="px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive border-destructive/30">
                    {item.reason}
                  </span>
                  <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1", sCfg.color)}>
                    <SIcon className="h-2.5 w-2.5" /> {sCfg.label}
                  </span>
                  <div className="hidden sm:block flex-1" />
                  <span className="text-[10px] text-muted-foreground">{new Date(item.reportedAt).toLocaleString()}</span>
                </div>

                <p className="text-sm break-words">{item.content}</p>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] text-muted-foreground">
                  <span className="break-words">By: {item.author} · Reported by: {item.reportedBy}</span>
                  {item.status === "pending" && (
                    <div className="flex gap-1 w-full sm:w-auto">
                      {isRemovableContent && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 flex-1 sm:flex-none text-destructive" onClick={() =>
                          setConfirmAction({
                            item,
                            status: "resolved",
                            removeResource: true,
                            label: "Remove Content",
                            description: `This ${item.type} will be permanently removed.`,
                            destructive: true,
                          })
                        }>
                          <Trash2 className="h-2.5 w-2.5" /> Remove
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 flex-1 sm:flex-none" onClick={() =>
                        setConfirmAction({
                          item,
                          status: "resolved",
                          removeResource: false,
                          label: "Resolve Report",
                          description: isRemovableContent
                            ? "Mark report resolved and keep the content."
                            : "Mark report resolved.",
                        })
                      }>
                        <CheckCircle2 className="h-2.5 w-2.5" /> Resolve
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 flex-1 sm:flex-none" onClick={() =>
                        setConfirmAction({
                          item,
                          status: "dismissed",
                          label: "Dismiss Report",
                          description: "This report will be dismissed.",
                        })
                      }>
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
                if (!confirmAction) return;
                actionMutation.mutate({
                  item: confirmAction.item,
                  status: confirmAction.status,
                  removeResource: confirmAction.removeResource,
                });
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
