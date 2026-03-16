import type { ArenaPlayerStats } from "@/services/arena";

export const DEFAULT_PLAYER_STATS: ArenaPlayerStats = {
  xp: 0,
  wins: 0,
  totalPlayed: 0,
  streak: 0,
  bestStreak: 0,
  correctAnswers: 0,
  totalAnswers: 0,
  accuracy: 0,
  title: "Rookie",
};

export const DIFFICULTY_XP = {
  easy: 10,
  medium: 20,
  hard: 30,
} as const;

export const ARENA_TITLE_PROGRESSION = {
  Rookie: 0,
  Scholar: 200,
  Strategist: 500,
  Champion: 1000,
  Legend: 2000,
} as const;
