const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type PostTag = "question" | "rant" | "tip" | "meme" | "confession" | "discussion";
export type AcademicReaction = "🧠" | "💀" | "🔥" | "📚" | "😭" | "🤝";

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

export interface LoungePost {
  id: string;
  content: string;
  tag: PostTag;
  course?: string;
  timestamp: string;
  reactions: Record<AcademicReaction, number>;
  replies: number;
  anonymous_id: string;
}

export async function fetchLoungePosts(): Promise<LoungePost[]> {
  await delay(300);
  return [
    {
      id: "p1",
      content: "Does anyone actually understand how AVL rotations work or are we all just pretending? Asking for a friend (the friend is me).",
      tag: "question",
      course: "CS301",
      timestamp: "2026-03-08T09:15:00",
      reactions: { "🧠": 3, "💀": 12, "🔥": 1, "📚": 2, "😭": 8, "🤝": 15 },
      replies: 7,
      anonymous_id: "Anon#4821",
    },
    {
      id: "p2",
      content: "Just spent 4 hours debugging a segfault only to realize I forgot a semicolon. Engineering is glamorous.",
      tag: "rant",
      timestamp: "2026-03-08T08:42:00",
      reactions: { "🧠": 0, "💀": 24, "🔥": 2, "📚": 0, "😭": 18, "🤝": 31 },
      replies: 12,
      anonymous_id: "Anon#7733",
    },
    {
      id: "p3",
      content: "Pro tip: Record your lectures and play them at 2x speed before exams. You cover a whole semester in one night. Not that I recommend it... but it works.",
      tag: "tip",
      course: "CS302",
      timestamp: "2026-03-08T07:30:00",
      reactions: { "🧠": 15, "💀": 5, "🔥": 22, "📚": 8, "😭": 3, "🤝": 11 },
      replies: 9,
      anonymous_id: "Anon#2156",
    },
    {
      id: "p4",
      content: "The WiFi in Lab 302 has been down for 3 days and nobody has fixed it. We're coding on pen and paper at this point.",
      tag: "rant",
      timestamp: "2026-03-07T16:20:00",
      reactions: { "🧠": 0, "💀": 8, "🔥": 0, "📚": 0, "😭": 14, "🤝": 22 },
      replies: 5,
      anonymous_id: "Anon#9012",
    },
    {
      id: "p5",
      content: "I wrote my entire DBMS assignment in MongoDB syntax instead of SQL. Prof didn't notice. Chaotic neutral energy.",
      tag: "confession",
      course: "CS302",
      timestamp: "2026-03-07T14:55:00",
      reactions: { "🧠": 7, "💀": 19, "🔥": 14, "📚": 1, "😭": 3, "🤝": 6 },
      replies: 15,
      anonymous_id: "Anon#5544",
    },
    {
      id: "p6",
      content: "Can we talk about how the OS mid-sem is on the same day as the CN lab exam? Who makes these schedules?",
      tag: "discussion",
      course: "CS304",
      timestamp: "2026-03-07T11:10:00",
      reactions: { "🧠": 2, "💀": 6, "🔥": 1, "📚": 4, "😭": 21, "🤝": 28 },
      replies: 23,
      anonymous_id: "Anon#3367",
    },
    {
      id: "p7",
      content: "Whoever left their Thermodynamics textbook in the CS lab — wrong building, wrong department, wrong universe. Respect the commitment though.",
      tag: "meme",
      timestamp: "2026-03-07T09:45:00",
      reactions: { "🧠": 1, "💀": 30, "🔥": 8, "📚": 2, "😭": 4, "🤝": 12 },
      replies: 8,
      anonymous_id: "Anon#8891",
    },
    {
      id: "p8",
      content: "Subnetting finally clicked after watching that one YouTube video for the 11th time. There IS hope. Don't give up.",
      tag: "tip",
      course: "CS303",
      timestamp: "2026-03-06T22:30:00",
      reactions: { "🧠": 18, "💀": 2, "🔥": 9, "📚": 12, "😭": 1, "🤝": 7 },
      replies: 4,
      anonymous_id: "Anon#6120",
    },
  ];
}
