import type { InviteLink, InviteRegistration } from "@/types/admin";

export type { InviteLink, InviteRegistration } from "@/types/admin";

const INVITES_KEY = "skola-invite-links";
const REGISTRATIONS_KEY = "skola-invite-registrations";

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

export function createInviteLink(maxUses: number, createdBy: string, expiresAt?: string): InviteLink {
  const links = loadInviteLinks();
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const link: InviteLink = {
    id: `inv-${Date.now()}`,
    code,
    maxUses,
    usedCount: 0,
    createdAt: new Date().toISOString(),
    expiresAt,
    createdBy,
    active: true,
  };
  links.push(link);
  saveInviteLinks(links);
  return link;
}

export function deactivateInviteLink(id: string) {
  const links = loadInviteLinks();
  const link = links.find((l) => l.id === id);
  if (link) {
    link.active = false;
    saveInviteLinks(links);
  }
}

export function deleteInviteLink(id: string) {
  const links = loadInviteLinks().filter((l) => l.id !== id);
  saveInviteLinks(links);
}

export function getInviteByCode(code: string): InviteLink | null {
  const links = loadInviteLinks();
  const link = links.find((l) => l.code === code && l.active);
  if (!link) return null;
  if (link.maxUses > 0 && link.usedCount >= link.maxUses) return null;
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return null;
  return link;
}

export function useInviteLink(code: string): boolean {
  const links = loadInviteLinks();
  const link = links.find((l) => l.code === code && l.active);
  if (!link) return false;
  if (link.maxUses > 0 && link.usedCount >= link.maxUses) return false;
  link.usedCount++;
  if (link.maxUses > 0 && link.usedCount >= link.maxUses) {
    link.active = false;
  }
  saveInviteLinks(links);
  return true;
}

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
