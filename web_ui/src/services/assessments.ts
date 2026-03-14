import type { Assessment } from "@/types/admin";
import { apiFetch } from "./api";

export type { Assessment } from "@/types/admin";

export type AssessmentUpsertPayload = Omit<Assessment, "id" | "createdAt" | "updatedAt">;
export type AssessmentDraft = AssessmentUpsertPayload & { id?: string };

export async function loadAssessments(semesterId?: string): Promise<Assessment[]> {
  const params = new URLSearchParams();
  if (semesterId) params.set("semesterId", semesterId);
  const qs = params.toString();
  return apiFetch(`/academics/assessments${qs ? `?${qs}` : ""}`);
}

export async function createAssessment(payload: AssessmentUpsertPayload): Promise<Assessment> {
  return apiFetch("/academics/assessments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAssessment(
  id: string,
  payload: Partial<AssessmentUpsertPayload>,
): Promise<Assessment> {
  return apiFetch(`/academics/assessments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function saveAssessment(assessment: AssessmentDraft): Promise<Assessment> {
  if (assessment.id) {
    const { id, ...payload } = assessment;
    return updateAssessment(id, payload);
  }
  return createAssessment(assessment);
}

export async function deleteAssessment(id: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/academics/assessments/${id}`, {
    method: "DELETE",
  });
}
