import { apiFetch } from "./api";
import type { InviteLink, InviteRegistration } from "@/types/admin";

export type { InviteLink, InviteRegistration } from "@/types/admin";

export async function createInviteLink(classroomId: string, maxUses: number, expiresAt?: string): Promise<InviteLink> {
  return apiFetch("/admin/invites/generate", {
    method: "POST",
    body: JSON.stringify({ classroomId, maxUses, expiresAt }),
  });
}

export async function getInvitesByClassroom(classroomId: string): Promise<InviteLink[]> {
  return apiFetch(`/admin/invites?classroomId=${classroomId}`);
}

export async function deactivateInviteLink(id: string) {
  return apiFetch(`/admin/invites/${id}/deactivate`, { method: "POST" });
}

export async function deleteInviteLink(id: string) {
  return apiFetch(`/admin/invites/${id}/delete`, { method: "POST" });
}

export async function validateInviteCode(code: string): Promise<{ valid: boolean; classroom: { id: string; name: string } }> {
  return apiFetch(`/invites/validate/${code}`);
}

export async function registerWithInvite(code: string, fullName: string, telegramUsername?: string) {
  return apiFetch(`/invites/register/${code}`, {
    method: "POST",
    body: JSON.stringify({ fullName, telegramUsername }),
  });
}
