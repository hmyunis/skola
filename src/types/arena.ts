/** Shared arena types — safe to import from backend monorepo */

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

export interface PlayerStats {
  xp: number;
  wins: number;
  totalPlayed: number;
  streak: number;
  bestStreak: number;
  correctAnswers: number;
  totalAnswers: number;
}
