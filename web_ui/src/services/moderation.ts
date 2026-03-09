import type { FlaggedContent, UserReport } from "@/types/admin";

// Re-export types for backward compatibility
export type { FlaggedContent, UserReport } from "@/types/admin";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const REPORTS_KEY = "skola-user-reports";

export async function fetchFlaggedContent(): Promise<FlaggedContent[]> {
  await delay(300);
  return [
    { id: "f1", type: "post", content: "Extremely inappropriate comment about a professor...", author: "Anon#6120", reason: "Harassment", reportedBy: "Anon#4821", reportedAt: "2026-03-07T14:30:00", status: "pending" },
    { id: "f2", type: "resource", content: "Uploaded copyrighted textbook PDF", author: "Bereket Wolde", reason: "Copyright violation", reportedBy: "Meron Kebede", reportedAt: "2026-03-06T10:15:00", status: "pending" },
    { id: "f3", type: "reply", content: "Spam link to external website", author: "Anon#9012", reason: "Spam", reportedBy: "Anon#2156", reportedAt: "2026-03-05T18:45:00", status: "resolved" },
    { id: "f4", type: "quiz", content: "Quiz with offensive question content", author: "Anon#3367", reason: "Offensive content", reportedBy: "Anon#7733", reportedAt: "2026-03-04T09:20:00", status: "dismissed" },
    { id: "f5", type: "post", content: "Sharing exam answers openly in the lounge", author: "Anon#5544", reason: "Academic dishonesty", reportedBy: "Anon#8891", reportedAt: "2026-03-08T08:00:00", status: "pending" },
  ];
}

export function loadUserReports(): UserReport[] {
  try {
    const s = localStorage.getItem(REPORTS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

export function saveUserReport(report: UserReport) {
  const existing = loadUserReports();
  existing.unshift(report);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(existing));
}

export async function fetchAllFlaggedContent(): Promise<FlaggedContent[]> {
  const [defaultItems, userReports] = await Promise.all([
    fetchFlaggedContent(),
    Promise.resolve(loadUserReports()),
  ]);
  const mapped: FlaggedContent[] = userReports.map((r) => ({
    id: r.id,
    type: r.type,
    content: r.content,
    author: r.author,
    reason: r.reason,
    reportedBy: r.reportedBy,
    reportedAt: r.reportedAt,
    status: r.status,
  }));
  return [...mapped, ...defaultItems];
}
