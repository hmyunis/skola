import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchManagedUsers, type ManagedUser } from "@/services/admin";
import {
  loadInviteLinks,
  createInviteLink,
  deactivateInviteLink,
  deleteInviteLink,
  type InviteLink,
} from "@/services/invites";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { DatePicker } from "@/components/DatePicker";
import {
  Search,
  Shield,
  Crown,
  User,
  UserPlus,
  UserMinus,
  Circle,
  MessageCircle,
  Link as LinkIcon,
  Copy,
  Trash2,
  XCircle,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/stores/authStore";

const roleConfig = {
  owner: { label: "Owner", icon: Crown, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  admin: { label: "Admin", icon: Shield, color: "bg-primary/10 text-primary border-primary/30" },
  student: { label: "Student", icon: User, color: "bg-muted text-muted-foreground border-border" },
};

const statusDot: Record<string, string> = {
  active: "text-emerald-500",
  suspended: "text-amber-500",
  banned: "text-destructive",
};

// ─── Member List Tab ───
function MemberListTab({
  users,
  isLoading,
  isOwner,
}: {
  users: ManagedUser[];
  isLoading: boolean;
  isOwner: boolean;
}) {
  const [search, setSearch] = useState("");
  const [removingUser, setRemovingUser] = useState<ManagedUser | null>(null);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, student: 2 };
    if (roleOrder[a.role] !== roleOrder[b.role]) return roleOrder[a.role] - roleOrder[b.role];
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return a.name.localeCompare(b.name);
  });

  const handleRemove = () => {
    if (!removingUser) return;
    toast({ title: "User Removed", description: `${removingUser.name} has been removed from the group.` });
    setRemovingUser(null);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <div className="h-9 w-9 bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 bg-muted animate-pulse" />
                <div className="h-2.5 w-20 bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {sorted.map((user) => {
            const role = roleConfig[user.role];
            const RoleIcon = role.icon;
            return (
              <div key={user.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors group">
                <div className="relative">
                  <div className={cn("h-9 w-9 border flex items-center justify-center shrink-0", role.color)}>
                    <RoleIcon className="h-4 w-4" />
                  </div>
                  <Circle className={cn("h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 fill-current", statusDot[user.status] || "text-muted-foreground")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold truncate">{user.name}</p>
                    {user.role !== "student" && (
                      <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", role.color)}>
                        {role.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">Last active {user.lastActive}</p>
                </div>
                {user.telegramUsername && (
                  <a
                    href={`https://t.me/${user.telegramUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                    title={`Message @${user.telegramUsername}`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                )}
                {isOwner && user.role !== "owner" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setRemovingUser(user)}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          {sorted.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No members found</p>
          )}
        </div>
      )}

      <AlertDialog open={!!removingUser} onOpenChange={(o) => !o && setRemovingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removingUser?.name} from the platform?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Invite Links Tab ───
function InviteLinksTab() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<InviteLink[]>(loadInviteLinks);
  const [createOpen, setCreateOpen] = useState(false);
  const [maxUses, setMaxUses] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = () => setInvites(loadInviteLinks());

  const handleCreate = () => {
    const link = createInviteLink(Number(maxUses) || 1, user?.name || "Admin", expiresAt || undefined);
    refresh();
    setCreateOpen(false);
    setMaxUses("1");
    setExpiresAt("");
    toast({ title: "Invite Created", description: `Code: ${link.code}` });
  };

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Copied", description: "Invite link copied to clipboard" });
    });
  };

  const handleDeactivate = (id: string) => {
    deactivateInviteLink(id);
    refresh();
    toast({ title: "Deactivated", description: "Invite link has been deactivated." });
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteInviteLink(deletingId);
    refresh();
    setDeletingId(null);
    toast({ title: "Deleted", description: "Invite link removed." });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3" /> Generate Link
        </Button>
      </div>

      {invites.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 p-8 text-center">
          <LinkIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground uppercase tracking-wider">No invite links yet</p>
          <p className="text-xs text-muted-foreground mt-1">Generate a link to invite new members</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => {
            const isExpired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
            const isExhausted = inv.maxUses > 0 && inv.usedCount >= inv.maxUses;
            const isInactive = !inv.active || isExpired || isExhausted;

            return (
              <div key={inv.id} className={cn("border p-3 sm:p-4 transition-colors", isInactive ? "border-border bg-muted/30 opacity-60" : "border-border hover:bg-accent/20")}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-bold font-mono tracking-wider">{inv.code}</code>
                      {isInactive && (
                        <span className="px-1.5 py-0.5 border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {isExpired ? "Expired" : isExhausted ? "Used up" : "Inactive"}
                        </span>
                      )}
                      {!isInactive && (
                        <span className="px-1.5 py-0.5 border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {inv.usedCount}/{inv.maxUses === 0 ? "∞" : inv.maxUses} uses · Created by {inv.createdBy} · {new Date(inv.createdAt).toLocaleDateString()}
                      {inv.expiresAt && ` · Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isInactive && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleCopyLink(inv.code)}>
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600 hover:text-amber-600" onClick={() => handleDeactivate(inv.id)}>
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingId(inv.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-sm">Generate Invite Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Max Uses</label>
              <Input
                type="number"
                min="0"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="0 = unlimited"
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Set to 0 for unlimited uses</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Expires At (optional)</label>
              <DatePicker value={expiresAt} onChange={setExpiresAt} placeholder="No expiry" />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="w-full sm:w-auto" onClick={handleCreate}>
                <LinkIcon className="h-3 w-3" /> Generate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invite Link</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this invite link.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Members Page ───
const Members = () => {
  const { isAdmin, isOwner } = useAuth();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["managedUsers"],
    queryFn: fetchManagedUsers,
  });

  const online = users.filter((u) => u.status === "active").length;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Community</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Members</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {users.length} members · {online} active
        </p>
      </div>

      {isAdmin ? (
        <Tabs defaultValue="members">
          <TabsList className="w-full">
            <TabsTrigger value="members" className="flex-1 text-xs uppercase tracking-wider">Members</TabsTrigger>
            <TabsTrigger value="invites" className="flex-1 text-xs uppercase tracking-wider">Invite Links</TabsTrigger>
          </TabsList>
          <TabsContent value="members">
            <MemberListTab users={users} isLoading={isLoading} isOwner={isOwner} />
          </TabsContent>
          <TabsContent value="invites">
            <InviteLinksTab />
          </TabsContent>
        </Tabs>
      ) : (
        <MemberListTab users={users} isLoading={isLoading} isOwner={isOwner} />
      )}
    </div>
  );
};

export default Members;
