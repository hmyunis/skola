import type { PostTag, AcademicReaction, LoungeReply, LoungePost } from "@/types/lounge";

// Re-export types for backward compatibility
export type { PostTag, AcademicReaction, LoungeReply, LoungePost } from "@/types/lounge";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

const MOCK_SEMESTER_ID = "sem-2";

export async function fetchPosts(semesterId?: string): Promise<LoungePost[]> {
  await delay(400);
  if (semesterId && semesterId !== MOCK_SEMESTER_ID) return [];
  return [
    {
      id: "p1",
      author: "Anon#4821",
      title: "Is it just me or is the DSA mid-sem syllabus way too huge?",
      content:
        "I mean, come on! Binary trees, BSTs, AVL trees, B-trees, heaps, sorting, searching... It's like they want us to become walking encyclopedias in 2 months. Anyone else feeling the same?",
      tags: ["question", "rant"],
      reactions: { "🧠": 5, "💀": 2, "🔥": 8, "📚": 12, "😭": 23, "🤝": 31 },
      createdAt: "2026-03-08T14:30:00",
      replies: 17,
    },
    {
      id: "p2",
      author: "Anon#7733",
      title: "Pro-tip: Use a password manager!",
      content:
        "Seriously, folks. Stop reusing passwords across different sites. It's a huge security risk. Use a password manager like Bitwarden or LastPass to generate and store strong, unique passwords for each site. Your future self will thank you.",
      tags: ["tip"],
      reactions: { "🧠": 18, "💀": 0, "🔥": 2, "📚": 3, "😭": 1, "🤝": 11 },
      createdAt: "2026-03-07T21:15:00",
      replies: 5,
    },
    {
      id: "p3",
      author: "Anon#2156",
      title: "When the TA says 'just read the documentation'...",
      content: "https://i.imgur.com/9NoKGjz.jpeg",
      tags: ["meme"],
      reactions: { "🧠": 2, "💀": 42, "🔥": 3, "📚": 1, "😭": 17, "🤝": 28 },
      createdAt: "2026-03-07T11:00:00",
      replies: 9,
    },
    {
      id: "p4",
      author: "Anon#9012",
      title: "Confession: I still don't understand dynamic programming",
      content:
        "I've watched all the lectures, read the textbook, and even tried solving practice problems, but I still can't wrap my head around dynamic programming. It's like some kind of black magic. Anyone else in the same boat?",
      tags: ["confession"],
      reactions: { "🧠": 1, "💀": 7, "🔥": 0, "📚": 15, "😭": 33, "🤝": 45 },
      createdAt: "2026-03-06T18:45:00",
      replies: 21,
    },
    {
      id: "p5",
      author: "Anon#5544",
      title: "Discussion: What are your favorite resources for learning system design?",
      content:
        "I'm trying to level up my system design skills, but I'm not sure where to start. What are your favorite books, articles, or online courses for learning system design concepts and patterns?",
      tags: ["discussion"],
      reactions: { "🧠": 22, "💀": 0, "🔥": 7, "📚": 28, "😭": 0, "🤝": 14 },
      createdAt: "2026-03-05T09:20:00",
      replies: 12,
    },
  ];
}

export async function fetchReplies(postId: string): Promise<LoungeReply[]> {
  await delay(250);
  return [
    {
      id: "r1",
      postId,
      author: "Anon#3367",
      content: "Yeah, I feel you. It's like they're trying to cram a whole semester's worth of material into a single mid-sem.",
      createdAt: "2026-03-08T15:00:00",
      reactions: { "🧠": 2, "💀": 1, "🔥": 0, "📚": 2, "😭": 7, "🤝": 14 },
    },
    {
      id: "r2",
      postId,
      author: "Anon#8891",
      content:
        "I've started using flashcards to memorize the different tree algorithms and their time complexities. It seems to be helping a bit.",
      createdAt: "2026-03-08T15:30:00",
      reactions: { "🧠": 5, "💀": 0, "🔥": 1, "📚": 9, "😭": 2, "🤝": 6 },
    },
    {
      id: "r3",
      postId,
      author: "Anon#6120",
      content: "Don't worry, you're not alone. I'm completely lost too.",
      createdAt: "2026-03-08T16:00:00",
      reactions: { "🧠": 0, "💀": 2, "🔥": 0, "📚": 1, "😭": 12, "🤝": 18 },
    },
  ];
}
