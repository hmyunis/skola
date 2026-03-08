import type { Semester } from "@/types/admin";

// Re-export type for backward compatibility
export type { Semester } from "@/types/admin";

const SEMESTERS_KEY = "scola-admin-semesters";

const DEFAULT_SEMESTERS: Semester[] = [
  {
    id: "sem-1",
    name: "Fall 2025",
    year: 2025,
    startDate: "2025-08-15",
    endDate: "2025-12-20",
    status: "archived",
    examPeriod: { start: "2025-12-01", end: "2025-12-18" },
    breaks: [{ name: "Mid-Term Break", start: "2025-10-10", end: "2025-10-14" }],
  },
  {
    id: "sem-2",
    name: "Spring 2026",
    year: 2026,
    startDate: "2026-01-15",
    endDate: "2026-05-30",
    status: "active",
    examPeriod: { start: "2026-05-10", end: "2026-05-28" },
    breaks: [{ name: "Spring Break", start: "2026-03-20", end: "2026-03-27" }],
  },
  {
    id: "sem-3",
    name: "Fall 2026",
    year: 2026,
    startDate: "2026-08-15",
    endDate: "2026-12-20",
    status: "upcoming",
  },
];

export function loadSemesters(): Semester[] {
  try {
    const s = localStorage.getItem(SEMESTERS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_SEMESTERS;
}

export function saveSemesters(semesters: Semester[]) {
  localStorage.setItem(SEMESTERS_KEY, JSON.stringify(semesters));
}
