import { apiFetch } from "./api";
import type {
  ArenaLeaderboardResponse,
  ArenaPlayerStats,
  ArenaQuizListResponse,
  ArenaReport,
  CustomQuiz,
  LeaderboardEntry,
  QuizAttemptResult,
  QuizDifficulty,
  QuizQuestion,
} from "@/types/arena";

export type {
  ArenaLeaderboardResponse,
  ArenaPlayerStats,
  ArenaQuizListResponse,
  ArenaReport,
  CustomQuiz,
  LeaderboardEntry,
  QuizAttemptResult,
  QuizDifficulty,
  QuizQuestion,
} from "@/types/arena";

export const ARENA_TITLES: Record<string, { label: string; minXp: number }> = {
  rookie: { label: "Rookie", minXp: 0 },
  scholar: { label: "Scholar", minXp: 200 },
  strategist: { label: "Strategist", minXp: 500 },
  champion: { label: "Champion", minXp: 1000 },
  legend: { label: "Legend", minXp: 2000 },
};

function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchArenaQuizzes(params?: {
  page?: number;
  limit?: number;
  search?: string;
  course?: string;
}): Promise<ArenaQuizListResponse> {
  const qs = toQuery({
    page: params?.page,
    limit: params?.limit,
    search: params?.search,
    course: params?.course,
  });
  return apiFetch(`/arena/quizzes${qs}`);
}

export async function fetchArenaQuiz(quizId: string): Promise<CustomQuiz> {
  const quiz = await apiFetch(`/arena/quizzes/${quizId}`);
  return {
    ...quiz,
    questionCount: quiz.questions?.length || 0,
  };
}

export async function createArenaQuiz(data: {
  title: string;
  course: string;
  isAnonymous?: boolean;
  maxAttempts?: number;
  questions: Array<{
    questionText: string;
    options: string[];
    correctOptionIndex: number;
    difficulty: QuizDifficulty;
    durationSeconds?: number;
  }>;
}): Promise<CustomQuiz> {
  const quiz = await apiFetch("/arena/quizzes", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return {
    ...quiz,
    questionCount: quiz.questions?.length || 0,
  };
}

export async function deleteArenaQuiz(quizId: string) {
  return apiFetch(`/arena/quizzes/${quizId}`, { method: "DELETE" });
}

export async function submitArenaAttempt(
  quizId: string,
  answers: number[],
): Promise<QuizAttemptResult> {
  return apiFetch(`/arena/quizzes/${quizId}/attempt`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function fetchArenaStats(): Promise<ArenaPlayerStats> {
  return apiFetch("/arena/me/stats");
}

export async function fetchLeaderboard(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ArenaLeaderboardResponse> {
  const qs = toQuery({
    page: params?.page,
    limit: params?.limit,
    search: params?.search,
  });
  return apiFetch(`/arena/leaderboard${qs}`);
}

export async function fetchQuizQuestions(course: string): Promise<QuizQuestion[]> {
  const fullQuiz = await fetchRandomQuizByCourse(course);
  if (!fullQuiz.questions?.length) {
    throw new Error("Selected quiz has no questions.");
  }
  return fullQuiz.questions;
}

export async function fetchRandomQuizByCourse(course: string): Promise<CustomQuiz> {
  const list = await fetchArenaQuizzes({ page: 1, limit: 50, course });
  const available = list.data.filter((quiz) => quiz.canAttempt);
  if (!available.length) {
    throw new Error("No quizzes with remaining attempts found for the selected course.");
  }
  const randomQuiz = available[Math.floor(Math.random() * available.length)];
  return fetchArenaQuiz(randomQuiz.id);
}

export async function reportArenaQuiz(
  quizId: string,
  payload: { reason: string; details?: string },
) {
  return apiFetch(`/arena/quizzes/${quizId}/report`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchArenaReports(
  status?: "pending" | "resolved" | "dismissed",
): Promise<ArenaReport[]> {
  const qs = status ? `?status=${status}` : "";
  return apiFetch(`/arena/moderation/reports${qs}`);
}

export async function reviewArenaReport(
  reportId: string,
  payload: { status: "resolved" | "dismissed"; removeQuiz?: boolean },
) {
  return apiFetch(`/arena/moderation/reports/${reportId}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
