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

const MOCK_REPLIES: Record<string, LoungeReply[]> = {
  p1: [
    { id: "r1-1", content: "Left rotation, right rotation, left-right, right-left. Draw it out on paper, it clicks eventually.", timestamp: "2026-03-08T09:20:00", anonymous_id: "Anon#2156" },
    { id: "r1-2", content: "I just memorize the patterns tbh. Understanding is overrated when the exam is in 2 days.", timestamp: "2026-03-08T09:35:00", anonymous_id: "Anon#5544" },
    { id: "r1-3", content: "Watch Abdul Bari's video on YouTube. Changed my life.", timestamp: "2026-03-08T09:50:00", anonymous_id: "Anon#6120" },
  ],
  p2: [
    { id: "r2-1", content: "This is why I switched to Rust. The compiler yells at you BEFORE you waste 4 hours.", timestamp: "2026-03-08T08:50:00", anonymous_id: "Anon#3367" },
    { id: "r2-2", content: "Semicolons are the silent killers of engineering careers.", timestamp: "2026-03-08T09:00:00", anonymous_id: "Anon#8891" },
    { id: "r2-3", content: "Use an IDE with better linting? VSCode catches that stuff instantly.", timestamp: "2026-03-08T09:10:00", anonymous_id: "Anon#4821" },
    { id: "r2-4", content: "4 hours is rookie numbers. I once spent 8 hours on a missing bracket.", timestamp: "2026-03-08T09:25:00", anonymous_id: "Anon#9012" },
  ],
  p3: [
    { id: "r3-1", content: "This actually works. Did it for CN and got a B+. Not proud but not sorry either.", timestamp: "2026-03-08T07:45:00", anonymous_id: "Anon#7733" },
    { id: "r3-2", content: "Bold of you to assume lectures are recorded.", timestamp: "2026-03-08T08:00:00", anonymous_id: "Anon#9012" },
  ],
  p5: [
    { id: "r5-1", content: "HOW did the prof not notice?? MongoDB syntax looks nothing like SQL 😭", timestamp: "2026-03-07T15:10:00", anonymous_id: "Anon#4821" },
    { id: "r5-2", content: "Chaotic neutral is the perfect description. Legend.", timestamp: "2026-03-07T15:30:00", anonymous_id: "Anon#2156" },
  ],
  p6: [
    { id: "r6-1", content: "The academic office literally does not care. We've complained 3 times.", timestamp: "2026-03-07T11:30:00", anonymous_id: "Anon#7733" },
    { id: "r6-2", content: "Same thing happened last sem with DBMS and Math. They never learn.", timestamp: "2026-03-07T11:45:00", anonymous_id: "Anon#5544" },
    { id: "r6-3", content: "Start a petition. I'll sign.", timestamp: "2026-03-07T12:00:00", anonymous_id: "Anon#8891" },
  ],
};

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
      isAnonymous: true,
    },
    {
      id: "p2",
      content: "Just spent 4 hours debugging a segfault only to realize I forgot a semicolon. Engineering is glamorous.",
      tag: "rant",
      timestamp: "2026-03-08T08:42:00",
      reactions: { "🧠": 0, "💀": 24, "🔥": 2, "📚": 0, "😭": 18, "🤝": 31 },
      replies: 12,
      anonymous_id: "Anon#7733",
      displayName: "Riya Sharma",
      isAnonymous: false,
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
      isAnonymous: true,
    },
    {
      id: "p4",
      content: "The WiFi in Lab 302 has been down for 3 days and nobody has fixed it. We're coding on pen and paper at this point.",
      tag: "rant",
      timestamp: "2026-03-07T16:20:00",
      reactions: { "🧠": 0, "💀": 8, "🔥": 0, "📚": 0, "😭": 14, "🤝": 22 },
      replies: 5,
      anonymous_id: "Anon#9012",
      displayName: "Vikram Desai",
      isAnonymous: false,
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
      isAnonymous: true,
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
      isAnonymous: true,
    },
    {
      id: "p7",
      content: "Whoever left their Thermodynamics textbook in the CS lab — wrong building, wrong department, wrong universe. Respect the commitment though.",
      tag: "meme",
      timestamp: "2026-03-07T09:45:00",
      reactions: { "🧠": 1, "💀": 30, "🔥": 8, "📚": 2, "😭": 4, "🤝": 12 },
      replies: 8,
      anonymous_id: "Anon#8891",
      isAnonymous: true,
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
      displayName: "Priya Nair",
      isAnonymous: false,
    },
  ];
}

export async function fetchPostReplies(postId: string): Promise<LoungeReply[]> {
  await delay(200);
  return MOCK_REPLIES[postId] || [];
}
