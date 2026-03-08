import type { Announcement } from "@/types/admin";

// Re-export type for backward compatibility
export type { Announcement } from "@/types/admin";

const ANNOUNCEMENTS_KEY = "scola-admin-announcements";
const DISMISSED_KEY = "scola-dismissed-announcements";

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  { id: "a1", title: "Mid-Semester Examination Schedule Released", content: "The mid-semester examination schedule for Spring 2026 has been published. Please check your schedule page for details.", priority: "high", createdAt: "2026-03-01T09:00:00", expiresAt: "2026-03-20", createdBy: "Dawit Tadesse", targetAudience: "all", pinned: true },
  { id: "a2", title: "Lab 302 Maintenance", content: "Lab 302 will be unavailable for maintenance on March 10-11. All lab sessions will be relocated to Lab 204.", priority: "normal", createdAt: "2026-03-05T14:00:00", expiresAt: "2026-03-12", createdBy: "Meron Kebede", targetAudience: "students", pinned: false },
  { id: "a3", title: "Spring Break Reminder", content: "Spring break is from March 20-27. Campus facilities will operate on reduced hours.", priority: "low", createdAt: "2026-03-08T08:00:00", createdBy: "Dawit Tadesse", targetAudience: "all", pinned: false },
];

export function loadAnnouncements(): Announcement[] {
  try {
    const s = localStorage.getItem(ANNOUNCEMENTS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_ANNOUNCEMENTS;
}

export function saveAnnouncements(announcements: Announcement[]) {
  localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(announcements));
}

export function getDismissedAnnouncementIds(): string[] {
  try {
    const s = localStorage.getItem(DISMISSED_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

export function dismissAnnouncement(id: string) {
  const dismissed = getDismissedAnnouncementIds();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  }
}
