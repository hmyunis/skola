/** Shared resource types — safe to import from backend monorepo */

export type ResourceType = "pdf" | "slides" | "notes" | "video" | "code" | "link";
export type ResourceCategory = "lecture" | "lab" | "reference" | "exam-prep" | "project";

export interface Resource {
  id: string;
  title: string;
  course: string;
  type: ResourceType;
  category: ResourceCategory;
  uploadedBy: string;
  uploadedAt: string;
  size: string;
  rating: number;
  totalRatings: number;
  upvotes: number;
  downvotes: number;
  downloads: number;
  description: string;
  tags: string[];
}
