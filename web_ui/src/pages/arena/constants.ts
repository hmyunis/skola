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
  Scholar: 800,
  Strategist: 2000,
  Champion: 4000,
  Legend: 8000,
} as const;
