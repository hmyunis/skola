/** Shared lounge types — safe to import from backend monorepo */

export type PostTag = "question" | "rant" | "tip" | "meme" | "confession" | "discussion";
export type AcademicReaction = "🧠" | "💀" | "🔥" | "📚" | "😭" | "🤝";

export interface LoungeReply {
  id: string;
  content: string;
  timestamp: string;
  anonymous_id: string;
}

export interface LoungePost {
  id: string;
  content: string;
  tag: PostTag;
  course?: string;
  timestamp: string;
  reactions: Record<AcademicReaction, number>;
  replies: number;
  anonymous_id: string;
  displayName?: string;
  isAnonymous: boolean;
}
