import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createInviteLink, deactivateInviteLink, deleteInviteLink, getInvitesByClassroom } from "@/services/invites";
import { useClassroomStore } from "@/stores/classroomStore";
import { useAuth } from "@/stores/authStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Link2, Plus, Copy, Trash2, XCircle, Clock, Users, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { InviteLink } from "@/types/admin";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isExpired(link: InviteLink): boolean {
  if (!link.isActive) return true;
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return true;
  if (link.maxUses > 0 && link.uses >= link.maxUses) return true;
  return false;
}

const InviteCodesTab = () => {
  const { activeClassroom } = useClassroomStore();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["inviteLinks", activeClassroom?.id],
    queryFn: () => activeClassroom ? getInvitesByClassroom(activeClassroom.id) : Promise.resolve([]),
    enabled: !!activeClassroom,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InviteLink | null>(null);

  // Create form
  const [maxUses, setMaxUses] = useState("0");
  const [expiryDays, setExpiryDays] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: { maxUses: number; expiresAt?: string }) => 
      createInviteLink(activeClassroom!.id, data.maxUses, data.expiresAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inviteLinks"] });
      setShowCreate(false);
      setMaxUses("0");
      setExpiryDays("");
      toast({ title: "Invite created", description: "New invite code generated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateInviteLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inviteLinks"] });
      toast({ title: "Deactivated", description: "Invite code is no longer usable." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInviteLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inviteLinks"] });
      setDeleteTarget(null);
      toast({ title: "Deleted", description: "Invite code removed." });
    },
  });

  const handleCreate = () => {
    if (!activeClassroom || !user) {
      toast({ title: "Error", description: "No active classroom found.", variant: "destructive" });
      return;
    }
    const expiresAt = expiryDays && parseInt(expiryDays) > 0
      ? new Date(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    
    createMutation.mutate({ maxUses: parseInt(maxUses) || 0, expiresAt });
  };

  const handleDeactivate = (id: string) => {
    deactivateMutation.mutate(id);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `Code ${code} copied to clipboard.` });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const active = invites.filter((i) => !isExpired(i));
  const expired = invites.filter((i) => isExpired(i));

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-2xl font-black tabular-nums mt-1">{invites.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Active</p>
          <p className="text-2xl font-black tabular-nums mt-1 text-emerald-600">{active.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Expired</p>
          <p className="text-2xl font-black tabular-nums mt-1 text-muted-foreground">{expired.length}</p>
        </CardContent></Card>
      </div>

      {/* Create button */}
      <Button onClick={() => setShowCreate(true)} size="sm" className="text-xs font-bold uppercase tracking-wider gap-1">
        <Plus className="h-3 w-3" /> Generate Invite Code
      </Button>

      {/* Active invites */}
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Active Codes</p>
          {active.map((inv) => (
            <div key={inv.id} className="border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-accent/20 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 border border-emerald-500/30 bg-emerald-500/10 shrink-0">
                  <Link2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-black tracking-[0.2em]">{inv.code}</code>
                    <span className="px-1.5 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">Active</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                    <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" /> {inv.uses || 0}{inv.maxUses > 0 ? `/${inv.maxUses}` : "/∞"} uses</span>
                    {inv.expiresAt && (
                      <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> Expires {formatDate(inv.expiresAt)}</span>
                    )}
                    <span>Created {formatDate(inv.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyCode(inv.code)}>
                  <Copy className="h-3 w-3" /> Copy
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 text-xs text-amber-600" 
                  onClick={() => handleDeactivate(inv.id)}
                  disabled={deactivateMutation.isPending}
                >
                  {deactivateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  Deactivate
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expired / inactive invites */}
      {expired.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Expired / Inactive</p>
          {expired.map((inv) => (
            <div key={inv.id} className="border border-border/50 p-3 flex flex-col sm:flex-row sm:items-center gap-3 opacity-60">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 border border-border bg-muted shrink-0">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-bold tracking-[0.2em] text-muted-foreground">{inv.code}</code>
                    <span className="px-1.5 py-0.5 border border-border text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Inactive</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span>{inv.uses || 0} uses</span>
                    <span>Created {formatDate(inv.createdAt)}</span>
                  </div>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTarget(inv)}>
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            </div>
          ))}
        </div>
      )}

      {invites.length === 0 && (
        <div className="border border-dashed border-border p-8 text-center">
          <Link2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No invite codes yet. Generate one to let classmates join.</p>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Generate Invite Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest font-bold">Max Uses</Label>
              <Input
                type="number"
                min="0"
                placeholder="0 = unlimited"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Set to 0 for unlimited uses</p>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest font-bold">Expires After (days)</Label>
              <Input
                type="number"
                min="0"
                placeholder="Leave empty for no expiry"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Leave empty for no expiration</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} className="gap-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                {createMutation.isPending ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invite Code</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete code <strong>{deleteTarget?.code}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InviteCodesTab;
