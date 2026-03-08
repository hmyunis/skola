import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchManagedUsers, saveUserStatus, type ManagedUser } from "@/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  Shield,
  Crown,
  User,
  Ban,
  CheckCircle2,
  AlertTriangle,
  UserCog,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/stores/authStore";

const roleConfig = {
  owner: { label: "Owner", icon: Crown, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  admin: { label: "Admin", icon: Shield, color: "bg-primary/10 text-primary border-primary/30" },
  student: { label: "Student", icon: User, color: "bg-muted text-muted-foreground border-border" },
};

const statusConfig = {
  active: { label: "Active", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  suspended: { label: "Suspended", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  banned: { label: "Banned", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

const SUSPEND_DURATIONS = [
  { label: "8 Hours", value: "8h", ms: 8 * 60 * 60 * 1000 },
  { label: "2 Days", value: "2d", ms: 2 * 24 * 60 * 60 * 1000 },
  { label: "7 Days", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "1 Month", value: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
];

function formatRemaining(until: string): string {
  const diff = new Date(until).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h remaining`;
  return `${hours}h remaining`;
}

const AdminUsers = () => {
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["managedUsers"],
    queryFn: fetchManagedUsers,
  });

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Suspend dialog
  const [suspendTarget, setSuspendTarget] = useState<ManagedUser | null>(null);
  const [suspendDuration, setSuspendDuration] = useState("8h");

  // Ban / promote / demote confirm
  const [confirmAction, setConfirmAction] = useState<{
    user: ManagedUser;
    action: string;
    description: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const applyStatus = (userId: string, status: string, suspendedUntil?: string) => {
    saveUserStatus(userId, status, suspendedUntil);
    queryClient.invalidateQueries({ queryKey: ["managedUsers"] });
  };

  const handleSuspend = () => {
    if (!suspendTarget) return;
    const dur = SUSPEND_DURATIONS.find((d) => d.value === suspendDuration)!;
    const until = new Date(Date.now() + dur.ms).toISOString();
    applyStatus(suspendTarget.id, "suspended", until);
    toast({ title: "Suspended", description: `${suspendTarget.name} suspended for ${dur.label}.` });
    setSuspendTarget(null);
  };

  const filtered = users.filter((u) => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (filterStatus !== "all" && u.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    admins: users.filter((u) => u.role === "admin").length,
    banned: users.filter((u) => u.status === "banned").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Admin</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Users</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-2xl font-black tabular-nums mt-1">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Active</p>
          <p className="text-2xl font-black tabular-nums mt-1 text-emerald-600">{stats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Admins</p>
          <p className="text-2xl font-black tabular-nums mt-1">{stats.admins}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Banned</p>
          <p className="text-2xl font-black tabular-nums mt-1 text-destructive">{stats.banned}</p>
        </CardContent></Card>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex gap-2">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="student">Students</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="owner">Owners</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-border p-3 flex items-center gap-3">
              <div className="h-8 w-8 bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 bg-muted animate-pulse" />
                <div className="h-2.5 w-48 bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => {
            const role = roleConfig[user.role];
            const status = statusConfig[user.status];
            const RoleIcon = role.icon;
            return (
              <div key={user.id} className="border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-accent/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("p-2 border shrink-0", role.color)}>
                    <RoleIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold">{user.name}</p>
                      <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", role.color)}>{role.label}</span>
                      <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", status.color)}>{status.label}</span>
                      {user.status === "suspended" && user.suspendedUntil && (
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatRemaining(user.suspendedUntil)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{user.email} · Joined {user.joinedAt}</p>
                  </div>
                </div>
                {user.role !== "owner" && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {user.status === "active" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600" onClick={() => setSuspendTarget(user)}>
                        <AlertTriangle className="h-3 w-3" /> Suspend
                      </Button>
                    )}
                    {user.status === "suspended" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                        applyStatus(user.id, "active");
                        toast({ title: "Reactivated", description: `${user.name} is active again.` });
                      }}>
                        <CheckCircle2 className="h-3 w-3" /> Activate
                      </Button>
                    )}
                    {user.status !== "banned" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => {
                        setConfirmAction({
                          user, action: "Ban", description: `${user.name} will be permanently banned and cannot log in.`, destructive: true,
                          onConfirm: () => {
                            applyStatus(user.id, "banned");
                            toast({ title: "Banned", description: `${user.name} has been permanently banned.` });
                          },
                        });
                      }}>
                        <Ban className="h-3 w-3" /> Ban
                      </Button>
                    )}
                    {user.status === "banned" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                        applyStatus(user.id, "active");
                        toast({ title: "Unbanned", description: `${user.name} has been unbanned.` });
                      }}>
                        <CheckCircle2 className="h-3 w-3" /> Unban
                      </Button>
                    )}
                    {isOwner && user.role === "student" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                        setConfirmAction({
                          user, action: "Promote", description: `${user.name} will be promoted to admin with elevated privileges.`,
                          onConfirm: () => {
                            // Role changes are local-only for now
                            toast({ title: "Promoted", description: `${user.name} is now an admin.` });
                          },
                        });
                      }}>
                        <Shield className="h-3 w-3" /> Promote
                      </Button>
                    )}
                    {isOwner && user.role === "admin" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600" onClick={() => {
                        setConfirmAction({
                          user, action: "Demote", description: `${user.name} will lose all admin privileges.`, destructive: true,
                          onConfirm: () => {
                            toast({ title: "Demoted", description: `${user.name} is now a student.` });
                          },
                        });
                      }}>
                        <UserCog className="h-3 w-3" /> Demote
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Suspend Duration Dialog */}
      <Dialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Suspend {suspendTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              The user will be temporarily blocked from logging in and accessing the platform for the selected duration.
            </p>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Duration</label>
              <Select value={suspendDuration} onValueChange={setSuspendDuration}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUSPEND_DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleSuspend}>
                <AlertTriangle className="h-3 w-3" /> Suspend
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generic Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.action} User</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmAction(null);
              }}
            >
              {confirmAction?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
