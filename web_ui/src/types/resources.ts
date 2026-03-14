export type ResourceType = "note" | "slide" | "past_paper" | "ebook" | "other";
export type VoteType = "up" | "down";

export interface Resource {
  id: string;
  classroomId: string;
  courseId: string;
  title: string;
  description?: string;
  type: ResourceType;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  externalUrl?: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  createdAt: string;
  updatedAt: string;
  userVote?: VoteType | null;
  uploader?: {
    id: string;
    name: string;
    initials?: string;
  } | null;
  course?: {
    id: string;
    code?: string;
    name?: string;
  } | null;
}

export interface ResourceReport {
  id: string;
  type: "resource";
  contentId: string;
  content: string;
  author: string;
  reason: string;
  details?: string;
  reportedBy: string;
  reportedAt: string;
  status: "pending" | "resolved" | "dismissed";
  reviewedAt?: string;
  reviewedBy?: string;
}
