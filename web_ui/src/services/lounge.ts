import { apiFetch } from "./api";
import type {
  PostTag,
  AcademicReaction,
  LoungePost,
  LoungeReply,
  LoungeFeedResponse,
} from "@/types/lounge";

// Re-export types for convenience
export type { PostTag, AcademicReaction, LoungePost, LoungeReply, LoungeFeedResponse } from "@/types/lounge";

export const POST_TAGS: { value: PostTag; label: string; color: string }[] = [
  { value: "question", label: "Question", color: "bg-primary/10 text-primary border-primary/30" },
  { value: "rant", label: "Rant", color: "bg-destructive/10 text-destructive border-destructive/30" },
  { value: "tip", label: "Tip", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  { value: "meme", label: "Meme", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { value: "confession", label: "Confession", color: "bg-violet-500/10 text-violet-600 border-violet-500/30" },
  { value: "discussion", label: "Discussion", color: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
];

export const REACTIONS: { emoji: AcademicReaction; label: string }[] = [
  { emoji: "🧠", label: "Big Brain" },
  { emoji: "💀", label: "Dead" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "📚", label: "Study" },
  { emoji: "😭", label: "Pain" },
  { emoji: "🤝", label: "Relatable" },
];

// ─── API Calls ───

export async function fetchLoungeFeed(params?: {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
  course?: string;
  sort?: string;
}): Promise<LoungeFeedResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  if (params?.tag) query.set("tag", params.tag);
  if (params?.course) query.set("course", params.course);
  if (params?.sort) query.set("sort", params.sort);

  const qs = query.toString();
  return apiFetch(`/lounge${qs ? `?${qs}` : ""}`);
}

export async function createPost(data: {
  content: string;
  tags?: string[];
  course?: string;
  isAnonymous?: boolean;
}): Promise<LoungePost> {
  return apiFetch("/lounge", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function editPost(
  postId: string,
  data: { content?: string; tags?: string[]; course?: string }
): Promise<LoungePost> {
  return apiFetch(`/lounge/${postId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deletePost(postId: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/lounge/${postId}`, { method: "DELETE" });
}

export async function reactToPost(
  postId: string,
  emoji: string
): Promise<{ reactions: Record<string, number>; userReaction: string | null }> {
  return apiFetch(`/lounge/${postId}/react`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export async function fetchPostReplies(postId: string): Promise<LoungeReply[]> {
  return apiFetch(`/lounge/${postId}/replies`);
}

export async function addReply(
  postId: string,
  data: { content: string; isAnonymous?: boolean }
): Promise<LoungeReply> {
  return apiFetch(`/lounge/${postId}/reply`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteReply(replyId: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/lounge/replies/${replyId}`, { method: "DELETE" });
}

export async function reportLoungeContent(data: {
  contentType: "post" | "reply";
  contentId: string;
  reason: string;
  details?: string;
}) {
  return apiFetch("/lounge/reports", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchLoungeReports(
  status?: "pending" | "resolved" | "dismissed",
  type?: "post" | "reply",
) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (type) query.set("type", type);
  const qs = query.toString();
  return apiFetch(`/lounge/reports${qs ? `?${qs}` : ""}`);
}

export async function reviewLoungeReport(
  reportId: string,
  payload: { status: "resolved" | "dismissed"; removeContent?: boolean },
) {
  return apiFetch(`/lounge/reports/${reportId}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
