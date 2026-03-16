import type { FlaggedContent } from "@/types/admin";
import { fetchResourceReports, reviewResourceReport } from "@/services/resources";
import { fetchLoungeReports, reviewLoungeReport } from "@/services/lounge";
import { fetchArenaReports, reviewArenaReport } from "@/services/arena";

export type { FlaggedContent } from "@/types/admin";

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

  const [resourceReports, loungeReports, arenaReports] = await Promise.all([
    shouldFetchResource ? fetchResourceReports(statusFilter) : Promise.resolve([]),
    shouldFetchLounge ? fetchLoungeReports(statusFilter, loungeTypeFilter) : Promise.resolve([]),
    shouldFetchArena ? fetchArenaReports(statusFilter) : Promise.resolve([]),
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

  return [...resourceItems, ...loungeItems, ...arenaItems].sort(
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
