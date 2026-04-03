import type { Semester } from "@/types/admin";
import { apiFetch } from "./api";

// Re-export type for backward compatibility
export type { Semester } from "@/types/admin";

export async function loadSemesters(): Promise<Semester[]> {
  return apiFetch("/academics/semesters");
}

export async function createSemester(semester: Omit<Semester, "id">): Promise<Semester> {
  return apiFetch("/academics/semesters", {
    method: "POST",
    body: JSON.stringify(semester),
  });
}

export async function updateSemester(id: string, semester: Partial<Semester>): Promise<Semester> {
  const { id: _ignored, ...payload } = semester as Partial<Semester> & { id?: string };
  return apiFetch(`/academics/semesters/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteSemester(id: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/academics/semesters/${id}`, {
    method: "DELETE",
  });
}

export async function fetchActiveSemester(): Promise<Semester> {
  return apiFetch("/academics/semesters/active");
}

