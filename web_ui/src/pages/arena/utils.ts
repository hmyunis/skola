import type { Course } from "@/services/courses";

export function getTitle(xp: number): string {
  if (xp >= 2000) return "Legend";
  if (xp >= 1000) return "Champion";
  if (xp >= 500) return "Strategist";
  if (xp >= 200) return "Scholar";
  return "Rookie";
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
