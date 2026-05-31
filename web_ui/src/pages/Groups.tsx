import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Crown,
  EyeOff,
  Loader2,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { fetchCourses } from "@/services/courses";
import { fetchManagedUsers } from "@/services/users";
import {
  acceptCourseGroupInvite,
  createCourseGroup,
  deleteGroupFormation,
  fetchGroupFormations,
  inviteToCourseGroup,
  joinCourseGroup,
  leaveCourseGroup,
  rejectCourseGroupInvite,
  transferCourseGroupLeadership,
  updateCourseGroupPrivacy,
  updateGroupFormation,
  upsertGroupFormation,
  type CourseGroup,
  type CourseGroupFormation,
} from "@/services/courseGroups";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const Groups = () => {
  const queryClient = useQueryClient();
  const { isOwner } = useAuth();
  const activeClassroom = useClassroomStore((state) => state.activeClassroom);
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");
  const [maxMembers, setMaxMembers] = useState(4);
  const [newGroupName, setNewGroupName] = useState("");
  const [hideIdentity, setHideIdentity] = useState(false);
  const [inviteUserByGroup, setInviteUserByGroup] = useState<Record<string, string>>({});

  const formationsQuery = useQuery({
    queryKey: ["courseGroupFormations"],
    queryFn: fetchGroupFormations,
  });

  const coursesQuery = useQuery({
    queryKey: ["courses", "group-formations"],
    queryFn: () => fetchCourses({ limit: 100 }),
    enabled: isOwner,
  });

  const membersQuery = useQuery({
    queryKey: ["managedUsers", activeClassroom?.id, "group-invites"],
    queryFn: () => fetchManagedUsers(activeClassroom!.id),
    enabled: Boolean(activeClassroom?.id),
  });

  const formations = formationsQuery.data || [];
  const selectedFormation = formations.find((formation) => formation.id === selectedFormationId) || null;
  const coursesWithoutFormation = useMemo(() => {
    const existingCourseIds = new Set(formations.map((formation) => formation.courseId));
    return (coursesQuery.data?.data || []).filter((course) => !existingCourseIds.has(course.id));
  }, [coursesQuery.data, formations]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["courseGroupFormations"] });

  const ownerCreateMutation = useMutation({
    mutationFn: () => upsertGroupFormation(courseId, { maxMembers }),
    onSuccess: async () => {
      await invalidate();
      setCourseId("");
      setMaxMembers(4);
      toast({ title: "Formation Created", description: "Group tracking is enabled for this course." });
    },
    onError: (error) => toast({ title: "Could Not Create", description: getErrorMessage(error, "Try again."), variant: "destructive" }),
  });

  const ownerUpdateMutation = useMutation({
    mutationFn: ({ formationId, nextMax }: { formationId: string; nextMax: number }) =>
      updateGroupFormation(formationId, { maxMembers: nextMax }),
    onSuccess: invalidate,
    onError: (error) => toast({ title: "Could Not Update", description: getErrorMessage(error, "Try again."), variant: "destructive" }),
  });

  const ownerDeleteMutation = useMutation({
    mutationFn: deleteGroupFormation,
    onSuccess: async () => {
      await invalidate();
      setSelectedFormationId(null);
      toast({ title: "Formation Removed", description: "Course grouping has been disabled." });
    },
    onError: (error) => toast({ title: "Could Not Remove", description: getErrorMessage(error, "Try again."), variant: "destructive" }),
  });

  const createGroupMutation = useMutation({
    mutationFn: (formationId: string) => createCourseGroup(formationId, { name: newGroupName, hideIdentity }),
    onSuccess: async () => {
      await invalidate();
      setNewGroupName("");
      toast({ title: "Group Created", description: "You are the group leader." });
    },
    onError: (error) => toast({ title: "Could Not Create Group", description: getErrorMessage(error, "Try again."), variant: "destructive" }),
  });

  const formationMutation = useMutation({
    mutationFn: async (action: () => Promise<CourseGroupFormation>) => action(),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error) => toast({ title: "Action Failed", description: getErrorMessage(error, "Try again."), variant: "destructive" }),
  });

  const renderGroupBox = (formation: CourseGroupFormation, group: CourseGroup) => {
    const isMine = group.isCurrentUserMember;
    const isInvited = group.isCurrentUserInvited;
    return (
      <button
        key={group.id}
        type="button"
        onClick={() => setSelectedFormationId(formation.id)}
        className={cn(
          "min-h-[112px] border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm",
          isMine
            ? "border-primary/50 bg-primary/10"
            : isInvited
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-border bg-card hover:bg-accent/30",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wider break-words">{group.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {group.memberCount}/{formation.maxMembers} members
            </p>
          </div>
          {group.currentUserRole === "leader" ? <Crown className="h-4 w-4 text-amber-500 shrink-0" /> : null}
        </div>
        <div className="mt-3 flex -space-x-1">
          {group.members.slice(0, 5).map((member) => (
            <span
              key={member.id}
              className="inline-flex h-7 w-7 items-center justify-center border border-background bg-muted text-[10px] font-bold"
              title={member.name}
            >
              {member.initials}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">
          Leader: {group.leaderName || "Unassigned"}
        </p>
      </button>
    );
  };

  if (selectedFormation) {
    const myGroup = selectedFormation.groups.find((group) => group.isCurrentUserMember) || null;
    const canCreateGroup = !selectedFormation.myGroupId;
    const members = membersQuery.data || [];

    return (
      <div className="max-w-5xl space-y-5 p-4 md:p-6">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setSelectedFormationId(null)}
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Groups</p>
            <h1 className="text-2xl font-black uppercase tracking-wider">{selectedFormation.course?.code || "Course"}</h1>
            <p className="text-sm text-muted-foreground">{selectedFormation.course?.name}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            Max size: <span className="font-black text-foreground">{selectedFormation.maxMembers}</span>
          </div>
        </div>

        {selectedFormation.myInvites.length > 0 && (
          <div className="border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Pending Invitations</p>
            {selectedFormation.myInvites.map((invite) => (
              <div key={invite.membershipId} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">{invite.groupName}</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => formationMutation.mutate(() => acceptCourseGroupInvite(invite.membershipId, { hideIdentity }))}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => formationMutation.mutate(() => rejectCourseGroupInvite(invite.membershipId))}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {canCreateGroup && (
          <div className="border border-border p-3 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider">Form a Group</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Group name"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                className="h-9 text-sm"
              />
              <Button onClick={() => createGroupMutation.mutate(selectedFormation.id)} disabled={createGroupMutation.isPending}>
                {createGroupMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Create
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={hideIdentity} onCheckedChange={setHideIdentity} />
              Hide my name in group boxes
            </label>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {selectedFormation.groups.map((group) => {
            const isLeader = group.currentUserRole === "leader";
            const inviteUserId = inviteUserByGroup[group.id] || "";
            return (
              <div key={group.id} className="border border-border bg-card p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider">{group.name}</p>
                    <p className="text-xs text-muted-foreground">{group.memberCount}/{group.maxMembers} members</p>
                  </div>
                  {!selectedFormation.myGroupId && !group.isFull && (
                    <Button size="sm" variant="outline" onClick={() => formationMutation.mutate(() => joinCourseGroup(group.id, { hideIdentity }))}>
                      <UserPlus className="h-3 w-3" />
                      Join
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {group.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 border border-border/70 p-2">
                      <span className="flex h-7 w-7 items-center justify-center bg-muted text-[10px] font-bold">{member.initials}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{member.name}{member.isSelf ? " (You)" : ""}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{member.role}</p>
                      </div>
                      {isLeader && member.userId && !member.isSelf && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px]"
                          onClick={() => formationMutation.mutate(() => transferCourseGroupLeadership(group.id, member.userId!))}
                        >
                          Make Leader
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {group.isCurrentUserMember && (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => formationMutation.mutate(() => updateCourseGroupPrivacy(group.id, !group.members.find((m) => m.isSelf)?.hideIdentity))}
                    >
                      <EyeOff className="h-3 w-3" />
                      Toggle Privacy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => formationMutation.mutate(() => leaveCourseGroup(group.id))}>
                      Leave
                    </Button>
                  </div>
                )}

                {isLeader && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invite member</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select value={inviteUserId} onValueChange={(value) => setInviteUserByGroup((prev) => ({ ...prev, [group.id]: value }))}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Choose member" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.userId || member.id}>{member.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={!inviteUserId}
                        onClick={() => formationMutation.mutate(() => inviteToCourseGroup(group.id, inviteUserId))}
                      >
                        <Send className="h-3 w-3" />
                        Invite
                      </Button>
                    </div>
                    {group.invites.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">{group.invites.length} pending invite(s)</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-5 p-4 md:p-6">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Courses</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Group Formation</h1>
        <p className="text-xs text-muted-foreground mt-1">Track course groups, invites, leaders, and privacy choices.</p>
      </div>

      {isOwner && (
        <div className="border border-border p-3 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider">Enable Grouping for a Course</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {coursesWithoutFormation.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code ? `${course.code} - ${course.name}` : course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={2}
              max={20}
              value={maxMembers}
              onChange={(event) => setMaxMembers(Math.max(2, Math.min(20, Number(event.target.value) || 2)))}
              className="h-9 text-sm"
            />
            <Button disabled={!courseId || ownerCreateMutation.isPending} onClick={() => ownerCreateMutation.mutate()}>
              <Plus className="h-3 w-3" />
              Create
            </Button>
          </div>
        </div>
      )}

      {formationsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-36 border border-border bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : formations.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">No course groups yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {formations.map((formation) => (
            <section key={formation.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setSelectedFormationId(formation.id)} className="text-left">
                  <h2 className="text-sm font-black uppercase tracking-wider hover:text-primary">
                    {formation.course?.code || "Course"} · {formation.course?.name}
                  </h2>
                </button>
                <span className="text-[10px] text-muted-foreground">{formation.groups.length} groups</span>
                <span className="text-[10px] text-muted-foreground">max {formation.maxMembers}</span>
                <div className="flex-1" />
                {isOwner && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={2}
                      max={20}
                      defaultValue={formation.maxMembers}
                      onBlur={(event) => {
                        const nextMax = Math.max(2, Math.min(20, Number(event.target.value) || formation.maxMembers));
                        if (nextMax !== formation.maxMembers) {
                          ownerUpdateMutation.mutate({ formationId: formation.id, nextMax });
                        }
                      }}
                      className="h-7 w-16 text-xs"
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => ownerDeleteMutation.mutate(formation.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {formation.groups.map((group) => renderGroupBox(formation, group))}
                <button
                  type="button"
                  onClick={() => setSelectedFormationId(formation.id)}
                  className="min-h-[112px] border border-dashed border-border p-3 text-left text-muted-foreground hover:bg-accent/30"
                >
                  <Plus className="h-4 w-4" />
                  <p className="mt-2 text-xs font-bold uppercase tracking-wider">Open course groups</p>
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default Groups;
