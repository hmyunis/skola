import type { FlaggedContent, UserReport } from "@/types/admin";
import { fetchResourceReports, reviewResourceReport } from "@/services/resources";
import { fetchLoungeReports, reviewLoungeReport } from "@/services/lounge";
import { fetchArenaReports, reviewArenaReport } from "@/services/arena";

export type { FlaggedContent, UserReport } from "@/types/admin";

interface LoungeModerationReport {
  id: string;
  type: "post" | "reply";
  content: string;
  author: string;
  reason: string;
  reportedBy: string;
  reportedAt: string;
  status: FlaggedContent["status"];
}

const REPORTS_KEY = "skola-user-reports";

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

export function updateUserReportStatus(reportId: string, status: UserReport["status"]) {
  const existing = loadUserReports();
  const updated = existing.map((r) => (r.id === reportId ? { ...r, status } : r));
  localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
}

export async function fetchAllFlaggedContent(filters?: {
  status?: FlaggedContent["status"] | "all";
  type?: FlaggedContent["type"] | "all";
}): Promise<FlaggedContent[]> {
  const statusFilter = filters?.status && filters.status !== "all" ? filters.status : undefined;
  const typeFilter = filters?.type && filters.type !== "all" ? filters.type : undefined;

  const shouldFetchResource = !typeFilter || typeFilter === "resource";
  const loungeTypeFilter = typeFilter === "post" || typeFilter === "reply" ? typeFilter : undefined;
  const shouldFetchLounge = !typeFilter || Boolean(loungeTypeFilter);
  const shouldFetchArena = !typeFilter || typeFilter === "quiz";
  const shouldLoadLocal = !typeFilter;

  const [resourceReports, loungeReports, arenaReports, localReports] = await Promise.all([
    shouldFetchResource ? fetchResourceReports(statusFilter) : Promise.resolve([]),
    shouldFetchLounge ? fetchLoungeReports(statusFilter, loungeTypeFilter) : Promise.resolve([]),
    shouldFetchArena ? fetchArenaReports(statusFilter) : Promise.resolve([]),
    shouldLoadLocal ? Promise.resolve(loadUserReports()) : Promise.resolve([]),
  ]);

  const resourceItems: FlaggedContent[] = resourceReports.map((report) => ({
    id: report.id,
    type: "resource",
    content: report.content,
    author: report.author,
    reason: report.reason,
    reportedBy: report.reportedBy,
    reportedAt: report.reportedAt,
    status: report.status,
  }));

  const loungeItems: FlaggedContent[] = (loungeReports as LoungeModerationReport[]).map((report) => ({
    id: report.id,
    type: report.type,
    content: report.content,
    author: report.author,
    reason: report.reason,
    reportedBy: report.reportedBy,
    reportedAt: report.reportedAt,
    status: report.status,
  }));

  const arenaItems: FlaggedContent[] = arenaReports.map((report) => ({
    id: report.id,
    type: "quiz",
    content: report.content,
    author: report.author,
    reason: report.reason,
    reportedBy: report.reportedBy,
    reportedAt: report.reportedAt,
    status: report.status,
  }));

  const localItems: FlaggedContent[] = (localReports as UserReport[])
    .filter((r) => !statusFilter || r.status === statusFilter)
    .filter((r) => !typeFilter || r.type === typeFilter)
    .filter((r) => r.type !== "resource" && r.type !== "post" && r.type !== "reply")
    .map((r) => ({
      id: r.id,
      type: r.type,
      content: r.content,
      author: r.author,
      reason: r.reason,
      reportedBy: r.reportedBy,
      reportedAt: r.reportedAt,
      status: r.status,
    }));

  return [...resourceItems, ...loungeItems, ...arenaItems, ...localItems].sort(
    (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
  );
}

export async function resolveResourceReport(reportId: string, removeResource: boolean) {
  return reviewResourceReport(reportId, { status: "resolved", removeResource });
}

export async function dismissResourceReport(reportId: string) {
  return reviewResourceReport(reportId, { status: "dismissed" });
}

export async function resolveLoungeReport(reportId: string, removeContent: boolean) {
  return reviewLoungeReport(reportId, { status: "resolved", removeContent });
}

export async function dismissLoungeReport(reportId: string) {
  return reviewLoungeReport(reportId, { status: "dismissed" });
}

export async function resolveArenaReport(reportId: string, removeQuiz: boolean) {
  return reviewArenaReport(reportId, { status: "resolved", removeQuiz });
}

export async function dismissArenaReport(reportId: string) {
  return reviewArenaReport(reportId, { status: "dismissed" });
}
