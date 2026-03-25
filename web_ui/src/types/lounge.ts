/** Shared lounge types — aligned with backend API response shapes */

export type PostTag = "question" | "rant" | "tip" | "meme" | "confession" | "discussion";
export type AcademicReaction = "🧠" | "💀" | "🔥" | "📚" | "😭" | "🤝";

export interface LoungeAuthor {
  id: string | null;
  name: string;
  anonymousId?: string | null;
  initials?: string;
  photoUrl?: string | null;
}

export interface LoungePost {
  id: string;
  content: string;
  imageUrl?: string | null;
  tags: string[];
  course?: string | null;
  isAnonymous: boolean;
  reactions: Record<string, number>;
  replyCount: number;
  author: LoungeAuthor;
  authorId: string;
  createdAt: string;
  editedAt?: string | null;
  userReaction: string | null;
}

export interface LoungeReply {
  id: string;
  content: string;
  isAnonymous: boolean;
  reactions: Record<string, number>;
  author: LoungeAuthor;
  authorId: string;
  createdAt: string;
  editedAt?: string | null;
}

export interface LoungeFeedResponse {
  data: LoungePost[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  };
}

export interface MentionableUser {
  id: string;
  name: string;
  username: string | null;
  mentionKey: string;
}

export interface MentionableUserSearchResponse {
  data: MentionableUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  };
}
