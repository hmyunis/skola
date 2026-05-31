import type { Course } from "@/services/courses";
import { ARENA_TITLE_PROGRESSION } from "./constants";

export function getTitle(xp: number): string {
  const normalizedXp = Number.isFinite(Number(xp)) ? Number(xp) : 0;
  const titles = Object.entries(ARENA_TITLE_PROGRESSION).sort(([, a], [, b]) => b - a);
  return titles.find(([, minXp]) => normalizedXp >= minXp)?.[0] || "Rookie";
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function toArenaCourseCode(value: string, selectedCourse?: Course | null): string | null {
  if (value === "none" || value === "all") return "";
  const selectedCode = selectedCourse?.code?.trim();
  if (selectedCourse && !selectedCode) return null;
  return selectedCode || value.trim();
}

export function getArenaCourseLabel(code: string, selectedCourseName?: string) {
  if (!code) return undefined;
  if (!selectedCourseName) return code;
  return `${code} - ${selectedCourseName}`;
}
