import { useEffect, useState } from "react";
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement,
} from "@/services/admin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/DateTimePicker";
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Pin,
  Send,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useClassroomStore } from "@/stores/classroomStore";

const priorityConfig = {
  low: { label: "Low", color: "bg-muted text-muted-foreground border-border" },
  normal: { label: "Normal", color: "bg-primary/10 text-primary border-primary/30" },
  high: { label: "High", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  urgent: { label: "Urgent", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

function formatDateTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getEditStatus(createdAt?: string, updatedAt?: string): "Edited" | "Not edited" {
  if (!createdAt || !updatedAt) return "Not edited";
  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return "Not edited";
  return updated - created > 1000 ? "Edited" : "Not edited";
}

function safeDisplayName(value: unknown): string {
  if (typeof value !== "string") return "Deleted user";
  const trimmed = value.trim();
  return trimmed || "Deleted user";
}

function AnnouncementFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Announcement | null;
  onSave: (a: Omit<Announcement, "id" | "createdAt" | "createdBy"> & { sendTelegram?: boolean }) => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [priority, setPriority] = useState<Announcement["priority"]>(initial?.priority || "normal");
  const [target, setTarget] = useState<Announcement["targetAudience"]>(initial?.targetAudience || "all");
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt || "");
  const [pinned, setPinned] = useState(initial?.pinned || false);
  const [sendTelegram, setSendTelegram] = useState(false);

  useEffect(() => {
    setTitle(initial?.title || "");
    setContent(initial?.content || "");
    setPriority(initial?.priority || "normal");
    setTarget(initial?.targetAudience || "all");
    setExpiresAt(initial?.expiresAt || "");
    setPinned(initial?.pinned || false);
    setSendTelegram(false);
  }, [initial, open]);

  const isValid = title.trim() && content.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">
            {initial ? "Edit Announcement" : "New Announcement"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Content</label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your announcement..." className="min-h-[100px] text-sm resize-none" rows={4} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Announcement["priority"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Audience</label>
              <Select value={target} onValueChange={(v) => setTarget(v as Announcement["targetAudience"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="students">Students</SelectItem>
                  <SelectItem value="admins">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Expires At</label>
              <DateTimePicker value={expiresAt} onChange={setExpiresAt} placeholder="No expiry" />
            </div>
          </div>
          <button
            onClick={() => setPinned(!pinned)}
            className={cn("flex items-center gap-2 px-3 py-2 border w-full text-left text-xs transition-colors", pinned ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground")}
          >
            <Pin className={cn("h-3.5 w-3.5", pinned && "fill-primary")} />
            {pinned ? "Pinned to top" : "Pin this announcement"}
          </button>

          {/* Telegram broadcast toggle */}
          {!initial && (
            <div className={cn(
              "flex items-center gap-3 px-3 py-3 border w-full transition-colors",
              sendTelegram ? "border-primary/40 bg-primary/5" : "border-border"
            )}>
              <Send className={cn("h-4 w-4 shrink-0", sendTelegram ? "text-primary" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">Send via Telegram</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Post this announcement to the classroom Telegram group
                </p>
              </div>
              <Switch
                checked={sendTelegram}
                onCheckedChange={setSendTelegram}
              />
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="w-full sm:w-auto" disabled={!isValid} onClick={() => {
              onSave({
                title: title.trim(),
                content: content.trim(),
                priority,
                expiresAt: expiresAt || undefined,
                targetAudience: target,
                pinned,
                sendTelegram: !initial ? sendTelegram : undefined,
              });
              onOpenChange(false);
            }}>
              {initial ? (
                <><Pencil className="h-3 w-3" /> Save</>
              ) : (
                <>
                  {sendTelegram ? <Send className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {sendTelegram ? " Publish & Send" : " Publish"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const AdminAnnouncements = () => {
  const activeClassroom = useClassroomStore((s) => s.activeClassroom);
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<Announcement[]>({
    queryKey: ["announcements", activeClassroom?.id],
    queryFn: fetchAnnouncements,
    enabled: !!activeClassroom?.id,
  });
  const announcements = data || [];

  const createMutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", activeClassroom?.id] });
      toast({ title: "Published", description: "Announcement is now live." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<Announcement, "id" | "createdAt" | "createdBy"> }) =>
      updateAnnouncement(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", activeClassroom?.id] });
      toast({ title: "Updated", description: "Announcement updated." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", activeClassroom?.id] });
      toast({ title: "Deleted", description: "Announcement removed." });
    },
  });

  const handleSave = async (payload: Omit<Announcement, "id" | "createdAt" | "createdBy"> & { sendTelegram?: boolean }) => {
    try {
      if (editing?.id) {
        await updateMutation.mutateAsync({ id: editing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setFormOpen(false);
      setEditing(null);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save announcement.",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      setDeletingId(null);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete announcement.",
      });
    }
  };

  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Admin</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Announcements</h1>
        </div>
        <Button size="sm" className="w-full sm:w-auto" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-3 w-3" /> New Announcement
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border bg-card p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <div className="flex-1" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <div className="flex justify-end gap-2 pt-1">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && sorted.length === 0 ? (
          <div className="min-h-[40vh] flex items-center justify-center border border-dashed border-border bg-card">
            <p className="text-xs sm:text-sm tracking-wider text-muted-foreground text-center px-4">
              No announcements yet.
            </p>
          </div>
        ) : (
          sorted.map((a) => {
            const pCfg = priorityConfig[a.priority];
            return (
              <div key={a.id} className={cn("border p-3 sm:p-4 space-y-2 transition-colors", a.pinned ? "border-primary/30 bg-primary/5" : "border-border bg-card hover:bg-card")}>
                <div className="flex items-center gap-2 flex-wrap">
                  {a.pinned && <Pin className="h-3 w-3 text-primary fill-primary" />}
                  <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", pCfg.color)}>{pCfg.label}</span>
                  <span className="px-1.5 py-0.5 border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{a.targetAudience}</span>
                  <div className="flex-1" />
                  <span className="text-[10px] text-muted-foreground">{formatDateTime(a.createdAt)}</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditing(a); setFormOpen(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingId(a.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <h3 className="text-sm font-bold">{a.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{a.content}</p>
                <p className="text-[10px] text-muted-foreground">By {safeDisplayName(a.createdBy)} · {getEditStatus(a.createdAt, a.updatedAt)}{a.expiresAt ? ` · Expires ${formatDateTime(a.expiresAt)}` : ""}</p>
              </div>
            );
          })
        )}
      </div>

      <AnnouncementFormDialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} initial={editing} onSave={handleSave} />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Announcement</AlertDialogTitle><AlertDialogDescription>This announcement will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminAnnouncements;
