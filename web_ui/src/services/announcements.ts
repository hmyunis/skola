import type { Announcement } from "@/types/admin";
import { apiFetch } from "./api";

// Re-export type for backward compatibility
export type { Announcement } from "@/types/admin";

const DISMISSED_KEY = "skola-dismissed-announcements";

type AnnouncementPayload = Omit<Announcement, "id" | "createdAt" | "createdBy"> & {
  sendTelegram?: boolean;
};

export async function fetchAnnouncements(): Promise<Announcement[]> {
  return apiFetch("/admin/announcements");
}

export async function createAnnouncement(payload: AnnouncementPayload): Promise<Announcement> {
  return apiFetch("/admin/announcements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAnnouncement(id: string, payload: AnnouncementPayload): Promise<Announcement> {
  return apiFetch(`/admin/announcements/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await apiFetch(`/admin/announcements/${id}`, {
    method: "DELETE",
  });
}

export async function triggerSurpriseAssessment(): Promise<Announcement> {
  return apiFetch("/admin/surprise-assessment/trigger", {
    method: "POST",
  });
}

export async function stopSurpriseAssessment(): Promise<{ success: boolean; stopped: number }> {
  return apiFetch("/admin/surprise-assessment/stop", {
    method: "POST",
  });
}

export function getDismissedAnnouncementIds(): string[] {
  try {
    const s = localStorage.getItem(DISMISSED_KEY);
    if (s) return JSON.parse(s);
  } catch {
    return [];
  }
  return [];
}

export function dismissAnnouncement(id: string) {
  const dismissed = getDismissedAnnouncementIds();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  }
}
