const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  course: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface CustomQuiz {
  id: string;
  title: string;
  course: string;
  questions: QuizQuestion[];
  createdAt: string;
  anonymous_id: string;
  createdByUser?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  anonymous_id: string;
  xp: number;
  wins: number;
  streak: number;
  accuracy: number;
  title: string;
}

export const ARENA_TITLES: Record<string, { label: string; minXp: number }> = {
  rookie: { label: "Rookie", minXp: 0 },
  scholar: { label: "Scholar", minXp: 200 },
  strategist: { label: "Strategist", minXp: 500 },
  champion: { label: "Champion", minXp: 1000 },
  legend: { label: "Legend", minXp: 2000 },
};

// ─── Custom quiz localStorage ───
const CUSTOM_QUIZZES_KEY = "scola-arena-custom-quizzes";

export function loadCustomQuizzes(): CustomQuiz[] {
  try {
    const s = localStorage.getItem(CUSTOM_QUIZZES_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

export function saveCustomQuiz(quiz: CustomQuiz) {
  const existing = loadCustomQuizzes();
  existing.unshift(quiz);
  localStorage.setItem(CUSTOM_QUIZZES_KEY, JSON.stringify(existing));
}

export function deleteCustomQuiz(id: string) {
  const existing = loadCustomQuizzes().filter((q) => q.id !== id);
  localStorage.setItem(CUSTOM_QUIZZES_KEY, JSON.stringify(existing));
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  await delay(300);
  return [
    { rank: 1, anonymous_id: "Anon#4821", xp: 2340, wins: 47, streak: 12, accuracy: 91, title: "Legend" },
    { rank: 2, anonymous_id: "Anon#7733", xp: 1980, wins: 39, streak: 8, accuracy: 87, title: "Champion" },
    { rank: 3, anonymous_id: "Anon#2156", xp: 1650, wins: 33, streak: 5, accuracy: 84, title: "Champion" },
    { rank: 4, anonymous_id: "Anon#9012", xp: 1200, wins: 25, streak: 3, accuracy: 79, title: "Champion" },
    { rank: 5, anonymous_id: "Anon#5544", xp: 890, wins: 18, streak: 2, accuracy: 76, title: "Strategist" },
    { rank: 6, anonymous_id: "Anon#3367", xp: 720, wins: 15, streak: 4, accuracy: 73, title: "Strategist" },
    { rank: 7, anonymous_id: "Anon#8891", xp: 540, wins: 11, streak: 1, accuracy: 70, title: "Strategist" },
    { rank: 8, anonymous_id: "Anon#6120", xp: 380, wins: 8, streak: 0, accuracy: 68, title: "Scholar" },
    { rank: 9, anonymous_id: "Anon#1445", xp: 210, wins: 5, streak: 1, accuracy: 64, title: "Scholar" },
    { rank: 10, anonymous_id: "Anon#0099", xp: 90, wins: 2, streak: 0, accuracy: 55, title: "Rookie" },
  ];
}

export async function fetchQuizQuestions(course: string): Promise<QuizQuestion[]> {
  await delay(400);

  const banks: Record<string, QuizQuestion[]> = {
    CS301: [
      { id: "q1", question: "What is the time complexity of searching in a balanced BST?", options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], correctIndex: 1, course: "CS301", difficulty: "easy" },
      { id: "q2", question: "Which traversal of a BST gives nodes in sorted order?", options: ["Pre-order", "Post-order", "In-order", "Level-order"], correctIndex: 2, course: "CS301", difficulty: "easy" },
      { id: "q3", question: "What is the worst-case time complexity of QuickSort?", options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"], correctIndex: 2, course: "CS301", difficulty: "medium" },
      { id: "q4", question: "Which data structure uses LIFO principle?", options: ["Queue", "Stack", "Deque", "Linked List"], correctIndex: 1, course: "CS301", difficulty: "easy" },
      { id: "q5", question: "The height of an AVL tree with n nodes is:", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], correctIndex: 1, course: "CS301", difficulty: "medium" },
    ],
    CS302: [
      { id: "q6", question: "Which normal form eliminates transitive dependencies?", options: ["1NF", "2NF", "3NF", "BCNF"], correctIndex: 2, course: "CS302", difficulty: "medium" },
      { id: "q7", question: "A foreign key references:", options: ["Primary key of same table", "Primary key of another table", "Any column", "Index column"], correctIndex: 1, course: "CS302", difficulty: "easy" },
      { id: "q8", question: "Which SQL command is used to remove a table?", options: ["DELETE", "REMOVE", "DROP", "TRUNCATE"], correctIndex: 2, course: "CS302", difficulty: "easy" },
      { id: "q9", question: "ACID stands for Atomicity, Consistency, Isolation, and:", options: ["Data", "Durability", "Dependency", "Distribution"], correctIndex: 1, course: "CS302", difficulty: "easy" },
      { id: "q10", question: "A relation in BCNF is always in:", options: ["1NF only", "2NF only", "3NF", "4NF"], correctIndex: 2, course: "CS302", difficulty: "hard" },
    ],
    CS303: [
      { id: "q11", question: "Which layer of OSI model handles routing?", options: ["Data Link", "Network", "Transport", "Session"], correctIndex: 1, course: "CS303", difficulty: "easy" },
      { id: "q12", question: "TCP is a _____ protocol.", options: ["Connectionless", "Connection-oriented", "Stateless", "Broadcast"], correctIndex: 1, course: "CS303", difficulty: "easy" },
      { id: "q13", question: "What is the default subnet mask for Class B?", options: ["255.0.0.0", "255.255.0.0", "255.255.255.0", "255.255.255.255"], correctIndex: 1, course: "CS303", difficulty: "medium" },
      { id: "q14", question: "HTTP operates at which OSI layer?", options: ["Transport", "Network", "Session", "Application"], correctIndex: 3, course: "CS303", difficulty: "easy" },
      { id: "q15", question: "Which protocol resolves IP to MAC address?", options: ["DNS", "ARP", "RARP", "DHCP"], correctIndex: 1, course: "CS303", difficulty: "medium" },
    ],
    CS304: [
      { id: "q16", question: "Which scheduling algorithm may cause starvation?", options: ["FCFS", "Round Robin", "SJF", "All of these"], correctIndex: 2, course: "CS304", difficulty: "medium" },
      { id: "q17", question: "A deadlock requires how many necessary conditions?", options: ["2", "3", "4", "5"], correctIndex: 2, course: "CS304", difficulty: "easy" },
      { id: "q18", question: "Belady's anomaly is associated with:", options: ["LRU", "FIFO", "Optimal", "Clock"], correctIndex: 1, course: "CS304", difficulty: "hard" },
      { id: "q19", question: "Which is NOT a process state?", options: ["Ready", "Running", "Blocked", "Compiled"], correctIndex: 3, course: "CS304", difficulty: "easy" },
      { id: "q20", question: "Semaphores were proposed by:", options: ["Turing", "Dijkstra", "Knuth", "Tanenbaum"], correctIndex: 1, course: "CS304", difficulty: "medium" },
    ],
  };

  return banks[course] || banks["CS301"];
}
