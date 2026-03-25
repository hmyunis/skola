import type { FeatureToggle } from "@/types/admin";
import { useClassroomStore } from "@/stores/classroomStore";
import { apiFetch } from "./api";
import { queryClient } from "@/lib/queryClient";

// Re-export type for backward compatibility
export type { FeatureToggle } from "@/types/admin";

export const DEFAULT_FEATURES: FeatureToggle[] = [
  { id: "ft-schedule", name: "Schedule", description: "Timetable, daily classes and weekly academic planning", enabled: true, category: "core" },
  { id: "ft-academics", name: "Assessments", description: "Assignments, grades, and academic tracking overview", enabled: true, category: "core" },
  { id: "ft-resources", name: "Resources", description: "Shared study materials, file hub and academic links", enabled: true, category: "core" },
  { id: "ft-lounge", name: "Lounge", description: "The community social feed for students and staff", enabled: true, category: "social" },
  { id: "ft-arena", name: "Arena", description: "Gamified quiz battles, XP levels and class leaderboards", enabled: true, category: "gamification" },
  { id: "ft-members", name: "Members", description: "Directory of all classroom students and administration", enabled: true, category: "social" },
  { id: "ft-announcements", name: "Announcements", description: "Official broadcasts and important class-wide updates", enabled: true, category: "core" },
  { id: "ft-appearance", name: "Settings", description: "User appearance, notification preferences, and personal configuration", enabled: true, category: "core" },
  { id: "ft-anon-posting", name: "Anonymous Posting", description: "Enable the ability for users to post anonymously in Lounge", enabled: true, category: "social" },
  { id: "ft-custom-quizzes", name: "Community Quizzes", description: "Allow students to create and share custom quizzes in Arena", enabled: true, category: "gamification" },
  { id: "ft-panic", name: "Surprise Assessment", description: "The panic button easter egg for experimental testing", enabled: true, category: "experimental" },
];

export function loadFeatures(): FeatureToggle[] {
  const activeClassroom = useClassroomStore.getState().activeClassroom;
  return getMergedFeatures(activeClassroom?.featureToggles);
}

export function getMergedFeatures(storedToggles: any): FeatureToggle[] {
  if (!storedToggles || !Array.isArray(storedToggles)) {
    return DEFAULT_FEATURES;
  }

  // Merge stored toggles with DEFAULT_FEATURES to ensure new features appear
  return DEFAULT_FEATURES.map((df) => {
    const stored = (storedToggles as FeatureToggle[]).find((f) => f.id === df.id);
    if (stored) {
      return { ...df, enabled: stored.enabled };
    }
    return df;
  });
}

export async function saveFeatures(features: FeatureToggle[]) {
  const activeClassroom = useClassroomStore.getState().activeClassroom;
  if (!activeClassroom) return;

  try {
    const updated = await apiFetch(`/classrooms/${activeClassroom.id}/features`, {
      method: 'PUT',
      body: JSON.stringify(features),
    });
    
    // Keep store and React Query cache aligned to avoid stale reverts in UI.
    useClassroomStore.getState().setActiveClassroom(updated);
    queryClient.setQueryData(["classroom", activeClassroom.id], updated);
  } catch (error) {
    console.error("Failed to save features:", error);
    throw error;
  }
}

export function isFeatureEnabled(id: string): boolean {
  const features = loadFeatures();
  return features.find(f => f.id === id)?.enabled ?? false;
}

export function useFeatureEnabled(id: string): boolean {
  const activeClassroom = useClassroomStore((s) => s.activeClassroom);
  const features = getMergedFeatures(activeClassroom?.featureToggles);
  return features.find(f => f.id === id)?.enabled ?? false;
}
