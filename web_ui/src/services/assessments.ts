import type { Assessment } from "@/types/admin";

export type { Assessment } from "@/types/admin";

const ASSESSMENTS_KEY = "skola-assessments";

const DEFAULT_ASSESSMENTS: Assessment[] = [
  {
    id: "assess-1",
    title: "Midterm Exam",
    type: "exam",
    courseCode: "CS301",
    dueDate: "2026-03-15",
    description: "Covers chapters 1-6 on data structures fundamentals",
    maxScore: 100,
    weight: 25,
    semesterId: "sem-2",
    createdAt: "2026-02-01",
  },
  {
    id: "assess-2",
    title: "Binary Tree Implementation",
    type: "assignment",
    courseCode: "CS301",
    dueDate: "2026-03-12",
    description: "Implement AVL tree with insert, delete, and search operations",
    maxScore: 50,
    weight: 10,
    semesterId: "sem-2",
    createdAt: "2026-02-20",
  },
  {
    id: "assess-3",
    title: "SQL Quiz",
    type: "quiz",
    courseCode: "CS302",
    dueDate: "2026-03-10",
    description: "Short quiz on SQL joins and subqueries",
    maxScore: 20,
    weight: 5,
    semesterId: "sem-2",
    createdAt: "2026-03-01",
  },
  {
    id: "assess-4",
    title: "Network Protocol Project",
    type: "project",
    courseCode: "CS303",
    dueDate: "2026-04-20",
    description: "Build a simple TCP chat application",
    maxScore: 100,
    weight: 30,
    semesterId: "sem-2",
    createdAt: "2026-02-15",
  },
];

export function loadAssessments(semesterId?: string): Assessment[] {
  try {
    const s = localStorage.getItem(ASSESSMENTS_KEY);
    if (s) {
      const all: Assessment[] = JSON.parse(s);
      return semesterId ? all.filter((a) => a.semesterId === semesterId) : all;
    }
  } catch {}
  return semesterId
    ? DEFAULT_ASSESSMENTS.filter((a) => a.semesterId === semesterId)
    : DEFAULT_ASSESSMENTS;
}

function loadAll(): Assessment[] {
  try {
    const s = localStorage.getItem(ASSESSMENTS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_ASSESSMENTS;
}

export function saveAssessment(assessment: Assessment) {
  const all = loadAll();
  const idx = all.findIndex((a) => a.id === assessment.id);
  if (idx >= 0) {
    all[idx] = assessment;
  } else {
    all.push(assessment);
  }
  localStorage.setItem(ASSESSMENTS_KEY, JSON.stringify(all));
}

export function deleteAssessment(id: string) {
  const all = loadAll().filter((a) => a.id !== id);
  localStorage.setItem(ASSESSMENTS_KEY, JSON.stringify(all));
}
