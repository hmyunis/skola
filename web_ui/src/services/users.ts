import { apiFetch } from "./api";
import type { ManagedUser } from "@/types/admin";

// Re-export type for backward compatibility
export type { ManagedUser } from "@/types/admin";

export async function fetchManagedUsers(classroomId: string): Promise<ManagedUser[]> {
  const members = await apiFetch(`/classrooms/${classroomId}/members`);
  return members.map((m: any) => ({
    id: m.id,
    name: m.user.name,
    email: m.user.email || `@${m.user.telegramUsername || m.user.id}`,
    role: m.role,
    status: m.user.isBanned ? "banned" : (m.user.suspendedUntil && new Date(m.user.suspendedUntil) > new Date() ? "suspended" : "active"),
    suspendedUntil: m.user.suspendedUntil,
    joinedAt: m.joinedAt,
    lastActive: m.user.updatedAt,
    telegramUsername: m.user.telegramUsername,
  }));
}

export async function saveUserStatus(classroomId: string, memberId: string, status: string, suspendedUntil?: string) {
  return apiFetch(`/classrooms/members/${memberId}/status`, {
    method: "POST",
    body: JSON.stringify({ status, suspendedUntil }),
    headers: { "x-classroom-id": classroomId },
  });
}

export async function saveUserRole(classroomId: string, memberId: string, role: string) {
  return apiFetch(`/classrooms/members/${memberId}/role`, {
    method: "POST",
    body: JSON.stringify({ role }),
    headers: { "x-classroom-id": classroomId },
  });
}

export async function removeMember(classroomId: string, memberId: string) {
  return apiFetch(`/classrooms/members/${memberId}`, {
    method: "DELETE",
    headers: { "x-classroom-id": classroomId },
  });
}
