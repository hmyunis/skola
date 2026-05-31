import { apiFetch } from "./api";

export type CourseGroupRole = "leader" | "member";
export type CourseGroupMemberStatus = "joined" | "invited" | "rejected";

export interface CourseGroupMember {
  id: string;
  userId: string | null;
  name: string;
  initials: string;
  role: CourseGroupRole;
  status: CourseGroupMemberStatus;
  hideIdentity: boolean;
  isSelf: boolean;
  joinedAt: string;
}

export interface CourseGroup {
  id: string;
  formationId: string;
  name: string;
  memberCount: number;
  pendingInviteCount: number;
  maxMembers: number;
  isFull: boolean;
  createdAt: string;
  isCurrentUserMember: boolean;
  isCurrentUserInvited: boolean;
  currentUserRole: CourseGroupRole | null;
  currentUserMembershipId: string | null;
  leaderName: string | null;
  members: CourseGroupMember[];
  invites: CourseGroupMember[];
}

export interface CourseGroupFormation {
  id: string;
  courseId: string;
  classroomId: string;
  maxMembers: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  course: {
    id: string;
    name: string;
    code?: string | null;
    instructor?: string | null;
  } | null;
  groups: CourseGroup[];
  myGroupId: string | null;
  myInvites: Array<{
    groupId: string;
    groupName: string;
    membershipId: string;
  }>;
}

export async function fetchGroupFormations(): Promise<CourseGroupFormation[]> {
  return apiFetch("/academics/group-formations");
}

export async function fetchGroupFormation(formationId: string): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/group-formations/${formationId}`);
}

export async function upsertGroupFormation(courseId: string, data: {
  maxMembers: number;
  isActive?: boolean;
}): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/courses/${courseId}/group-formation`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateGroupFormation(formationId: string, data: {
  maxMembers?: number;
  isActive?: boolean;
}): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/group-formations/${formationId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteGroupFormation(formationId: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/academics/group-formations/${formationId}`, { method: "DELETE" });
}

export async function createCourseGroup(formationId: string, data: {
  name?: string;
  hideIdentity?: boolean;
}): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/group-formations/${formationId}/groups`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function joinCourseGroup(groupId: string, data: {
  hideIdentity?: boolean;
}): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/groups/${groupId}/join`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function inviteToCourseGroup(groupId: string, userId: string): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/groups/${groupId}/invites`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function acceptCourseGroupInvite(membershipId: string, data: {
  hideIdentity?: boolean;
}): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/group-invites/${membershipId}/accept`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function rejectCourseGroupInvite(membershipId: string): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/group-invites/${membershipId}/reject`, { method: "POST" });
}

export async function transferCourseGroupLeadership(groupId: string, userId: string): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/groups/${groupId}/transfer-leadership`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function updateCourseGroupPrivacy(groupId: string, hideIdentity: boolean): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/groups/${groupId}/privacy`, {
    method: "PATCH",
    body: JSON.stringify({ hideIdentity }),
  });
}

export async function leaveCourseGroup(groupId: string): Promise<CourseGroupFormation> {
  return apiFetch(`/academics/groups/${groupId}/members/me`, { method: "DELETE" });
}
