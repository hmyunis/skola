import type { FlaggedContent } from "@/types/admin";
import { reviewResourceReport } from "@/services/resources";
import { reviewLoungeReport } from "@/services/lounge";
import { reviewArenaReport } from "@/services/arena";
import { apiFetch } from "@/services/api";

export type { FlaggedContent } from "@/types/admin";

export interface FlaggedContentStats {
  total: number;
  pending: number;
  resolved: number;
  dismissed: number;
}

function toModerationQuery(filters?: {
  status?: FlaggedContent["status"] | "all";
  type?: FlaggedContent["type"] | "all";
}) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters?.type && filters.type !== "all") {
    params.set("type", filters.type);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchAllFlaggedContent(filters?: {
  status?: FlaggedContent["status"] | "all";
  type?: FlaggedContent["type"] | "all";
}): Promise<FlaggedContent[]> {
  return apiFetch(`/admin/moderation/reports${toModerationQuery(filters)}`);
}

export async function fetchFlaggedContentStats(filters?: {
  status?: FlaggedContent["status"] | "all";
  type?: FlaggedContent["type"] | "all";
}): Promise<FlaggedContentStats> {
  return apiFetch(`/admin/moderation/stats${toModerationQuery(filters)}`);
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
