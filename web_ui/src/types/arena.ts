export type QuizDifficulty = "easy" | "medium" | "hard";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  course: string;
  difficulty: QuizDifficulty;
  durationSeconds: number;
}

export interface CustomQuiz {
  id: string;
  title: string;
  course: string;
  createdAt: string;
  anonymous_id: string;
  createdByUser: boolean;
  questionCount: number;
  maxAttempts: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  canAttempt: boolean;
  questions?: QuizQuestion[];
}

export interface ArenaQuizListResponse {
  data: CustomQuiz[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  };
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

export interface ArenaLeaderboardResponse {
  data: LeaderboardEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  };
}

export interface ArenaPlayerStats {
  xp: number;
  wins: number;
  totalPlayed: number;
  streak: number;
  bestStreak: number;
  correctAnswers: number;
  totalAnswers: number;
  accuracy: number;
  title: string;
}

export interface QuizAttemptResult {
  id: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  won: boolean;
  xpEarned: number;
  maxAttempts: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  stats: ArenaPlayerStats;
}

export interface ArenaReport {
  id: string;
  type: "quiz";
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
