import { apiFetch } from "./api";
import type { ManagedUser } from "@/types/admin";

// Re-export type for backward compatibility
export type { ManagedUser } from "@/types/admin";

export interface ManagedUserStats {
  totalMembers: number;
  activeMembers: number;
  adminMembers: number;
  bannedMembers: number;
}

export interface ImageUploadSettings {
  usePersonalApiKey: boolean;
  hasPersonalApiKey: boolean;
  keyHint: string | null;
}

export interface AssistantSettings {
  usePersonalApiKey: boolean;
  hasPersonalApiKey: boolean;
  keyHint: string | null;
  provider: "gemini";
  model: string;
  resetPolicy: string;
}

export interface AccountDeletionContext {
  classroomId: string;
  classroomName: string;
  isOwner: boolean;
  adminCandidates: Array<{
    memberId: string;
    userId: string;
    name: string;
    telegramUsername: string | null;
  }>;
}

export async function fetchManagedUsers(classroomId: string): Promise<ManagedUser[]> {
  const members = await apiFetch(`/classrooms/${classroomId}/members`);
  return members.map((m: any) => ({
    id: m.id,
    name: m.user.name,
    role: m.role,
    status: m.status || "active",
    suspendedUntil: m.suspendedUntil || null,
    joinedAt: m.joinedAt,
    lastActive: m.user.updatedAt,
    telegramUsername: m.user.telegramUsername,
  }));
}

export async function fetchManagedUsersStats(classroomId: string): Promise<ManagedUserStats> {
  return apiFetch(`/classrooms/${classroomId}/members/stats`);
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

export async function fetchImageUploadSettings(): Promise<ImageUploadSettings> {
  return apiFetch("/users/me/image-upload-settings");
}

export async function saveImageUploadSettings(data: {
  usePersonalApiKey?: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
}): Promise<ImageUploadSettings> {
  return apiFetch("/users/me/image-upload-settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function fetchAssistantSettings(): Promise<AssistantSettings> {
  return apiFetch("/users/me/assistant-settings");
}

export async function saveAssistantSettings(data: {
  usePersonalApiKey?: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
}): Promise<AssistantSettings> {
  return apiFetch("/users/me/assistant-settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function fetchAccountDeletionContext(): Promise<AccountDeletionContext> {
  return apiFetch("/users/me/account-deletion-context");
}

export async function deleteMyAccount(data: {
  successorMemberId?: string;
}) {
  return apiFetch("/users/me", {
    method: "DELETE",
    body: JSON.stringify(data),
  });
}
