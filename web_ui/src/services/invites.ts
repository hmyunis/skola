import { apiFetch } from "./api";
import type { InviteLink, InviteRegistration } from "@/types/admin";

export type { InviteLink, InviteRegistration } from "@/types/admin";

export async function createInviteLink(classroomId: string, maxUses: number, expiresAt?: string): Promise<InviteLink> {
  return apiFetch("/admin/invites/generate", {
    method: "POST",
    body: JSON.stringify({ maxUses, expiresAt }),
  });
}

export async function getInvitesByClassroom(classroomId: string): Promise<InviteLink[]> {
  return apiFetch("/admin/invites");
}

export async function deactivateInviteLink(id: string) {
  return apiFetch(`/admin/invites/${id}/deactivate`, { method: "POST" });
}

export async function deleteInviteLink(id: string) {
  return apiFetch(`/admin/invites/${id}/delete`, { method: "POST" });
}

export async function validateInviteCode(code: string): Promise<{ valid: boolean; classroom: { id: string; name: string } }> {
  return apiFetch(`/admin/invites/validate/${code}`);
}

// ─── Legacy/Mock logic for local state (registrations flow) ───
const INVITES_KEY = "skola-invite-links";

export function loadInviteLinks(): InviteLink[] {
  try {
    const s = localStorage.getItem(INVITES_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

export function saveInviteLinks(links: InviteLink[]) {
  localStorage.setItem(INVITES_KEY, JSON.stringify(links));
}

export function getInviteByCode(code: string): InviteLink | null {
  const links = loadInviteLinks();
  const link = links.find((l) => l.code === code && l.isActive);
  if (!link) return null;
  if (link.maxUses > 0 && link.uses >= link.maxUses) return null;
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return null;
  return link;
}

export function useInviteLink(code: string): boolean {
  const links = loadInviteLinks();
  const link = links.find((l) => l.code === code);
  if (!link) return false;
  if (link.maxUses > 0 && link.uses >= link.maxUses) return false;
  
  link.uses++;

  saveInviteLinks(links);
  return true;
}

// Keeping registrations as local for now or we could move them too
const REGISTRATIONS_KEY = "skola-invite-registrations";

export function loadRegistrations(): InviteRegistration[] {
  try {
    const s = localStorage.getItem(REGISTRATIONS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

export function saveRegistration(reg: InviteRegistration) {
  const regs = loadRegistrations();
  regs.push(reg);
  localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(regs));
}
