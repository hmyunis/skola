import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchManagedUsers, fetchManagedUsersStats, type ManagedUser } from "@/services/users";
import { useRemoveMember } from "@/hooks/use-members";
import { useClassroomStore } from "@/stores/classroomStore";
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
  Search,
  Shield,
  Crown,
  User,
  UserMinus,
  Circle,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

function formatLastActive(value?: string): string {
  if (!value) return "recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 2 * day) return "yesterday";
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;

  return date.toLocaleDateString();
}

const Members = () => {
  const { isAdmin, isOwner } = useAuth();
  const activeClassroom = useClassroomStore((s) => s.activeClassroom);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["managedUsers", activeClassroom?.id],
    queryFn: () => fetchManagedUsers(activeClassroom!.id),
    enabled: !!activeClassroom,
  });
  const { data: memberStats } = useQuery({
    queryKey: ["managedUsersStats", activeClassroom?.id],
    queryFn: () => fetchManagedUsersStats(activeClassroom!.id),
    enabled: !!activeClassroom,
  });
  const removeMemberMutation = useRemoveMember();

  const [search, setSearch] = useState("");
  const [removingUser, setRemovingUser] = useState<ManagedUser | null>(null);

  const totalMembers = memberStats?.totalMembers ?? 0;
  const onlineMembers = memberStats?.activeMembers ?? 0;

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.telegramUsername ? u.telegramUsername.toLowerCase().includes(q) : false)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, student: 2 };
    if (roleOrder[a.role] !== roleOrder[b.role]) return roleOrder[a.role] - roleOrder[b.role];
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return a.name.localeCompare(b.name);
  });

  const handleRemove = () => {
    if (!removingUser || !activeClassroom) return;
    removeMemberMutation.mutate(
      { classroomId: activeClassroom.id, memberId: removingUser.id },
      { onSuccess: () => setRemovingUser(null) }
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Community</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Members</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {totalMembers} members · {onlineMembers} active
        </p>
      </div>

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
                <div key={user.id} className="border border-border bg-card flex items-center gap-3 px-3 py-2.5 hover:bg-card transition-colors group">
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
                    <p className="text-[10px] text-muted-foreground truncate">Last active {formatLastActive(user.lastActive)}</p>
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
                      disabled={removeMemberMutation.isPending}
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
              <AlertDialogAction
                onClick={handleRemove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={removeMemberMutation.isPending}
              >
                {removeMemberMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Members;
