import { apiFetch } from "./api";
import type { Resource, ResourceType, VoteType, ResourceReport } from "@/types/resources";

export type { Resource, ResourceType, VoteType, ResourceReport } from "@/types/resources";

export const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "slide", label: "Slide" },
  { value: "past_paper", label: "Past Paper" },
  { value: "ebook", label: "E-Book" },
  { value: "other", label: "Other" },
];

export interface ResourceListResponse {
  data: Resource[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  };
}

export interface ResourceStatsResponse {
  totalResources: number;
  totalUpvotes: number;
  totalDownvotes: number;
  totalTypes: number;
}

export async function fetchResources(params?: {
  page?: number;
  limit?: number;
  courseId?: string;
  search?: string;
  type?: ResourceType;
}): Promise<ResourceListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.courseId) query.set("courseId", params.courseId);
  if (params?.search) query.set("search", params.search);
  if (params?.type) query.set("type", params.type);
  const qs = query.toString();
  return apiFetch(`/resources${qs ? `?${qs}` : ""}`);
}

export async function fetchResourceStats(params?: {
  courseId?: string;
  search?: string;
  type?: ResourceType;
}): Promise<ResourceStatsResponse> {
  const query = new URLSearchParams();
  if (params?.courseId) query.set("courseId", params.courseId);
  if (params?.search) query.set("search", params.search);
  if (params?.type) query.set("type", params.type);
  const qs = query.toString();
  return apiFetch(`/resources/stats${qs ? `?${qs}` : ""}`);
}

export async function uploadResourceFile(data: {
  file: File;
  courseId: string;
  title: string;
  description?: string;
  type: ResourceType;
  tags?: string[];
}): Promise<Resource> {
  const form = new FormData();
  form.append("file", data.file);
  form.append("courseId", data.courseId);
  form.append("title", data.title);
  form.append("description", data.description || "");
  form.append("type", data.type);
  form.append("tags", JSON.stringify(data.tags || []));

  return apiFetch("/resources/upload", {
    method: "POST",
    body: form,
  });
}

export async function createLinkResource(data: {
  courseId: string;
  title: string;
  description?: string;
  externalUrl: string;
  type?: ResourceType;
  tags?: string[];
}): Promise<Resource> {
  return apiFetch("/resources", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      type: data.type || "other",
    }),
  });
}

export async function updateResource(resourceId: string, data: Partial<Resource>): Promise<Resource> {
  return apiFetch(`/resources/${resourceId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function updateResourceFile(
  resourceId: string,
  data: {
    file: File;
    title: string;
    description?: string;
    courseId: string;
    type: ResourceType;
    tags?: string[];
  },
): Promise<Resource> {
  const form = new FormData();
  form.append("file", data.file);
  form.append("title", data.title);
  form.append("description", data.description || "");
  form.append("courseId", data.courseId);
  form.append("type", data.type);
  form.append("tags", JSON.stringify(data.tags || []));

  return apiFetch(`/resources/${resourceId}/upload`, {
    method: "PUT",
    body: form,
  });
}

export async function deleteResource(resourceId: string): Promise<{ success: boolean }> {
  return apiFetch(`/resources/${resourceId}`, { method: "DELETE" });
}

export async function voteResource(resourceId: string, voteType: VoteType): Promise<{ upvotes: number; downvotes: number; userVote: VoteType | null }> {
  return apiFetch(`/resources/${resourceId}/vote`, {
    method: "POST",
    body: JSON.stringify({ voteType }),
  });
}

export async function reportResource(resourceId: string, payload: { reason: string; details?: string }) {
  return apiFetch(`/resources/${resourceId}/report`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchResourceReports(status?: "pending" | "resolved" | "dismissed"): Promise<ResourceReport[]> {
  const qs = status ? `?status=${status}` : "";
  return apiFetch(`/resources/moderation/reports${qs}`);
}

export async function reviewResourceReport(
  reportId: string,
  payload: { status: "resolved" | "dismissed"; removeResource?: boolean },
) {
  return apiFetch(`/resources/moderation/reports/${reportId}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
