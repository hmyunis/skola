import type { FeatureToggle } from "@/types/admin";
import { useClassroomStore } from "@/stores/classroomStore";
import { apiFetch } from "./api";

// Re-export type for backward compatibility
export type { FeatureToggle } from "@/types/admin";

export const DEFAULT_FEATURES: FeatureToggle[] = [
  { id: "ft-schedule", name: "Schedule", description: "Class schedule and timetable management", enabled: true, category: "core" },
  { id: "ft-academics", name: "Academics", description: "Grades, assignments, and academic tracking", enabled: true, category: "core" },
  { id: "ft-resources", name: "Resources", description: "Shared study materials and file hub", enabled: true, category: "core" },
  { id: "ft-lounge", name: "Lounge", description: "Anonymous social feed for students", enabled: true, category: "social" },
  { id: "ft-arena", name: "Arena", description: "Gamified quiz battles and leaderboards", enabled: true, category: "gamification" },
  { id: "ft-panic", name: "Surprise Assessment", description: "The panic button easter egg", enabled: true, category: "experimental" },
  { id: "ft-anon-posting", name: "Anonymous Posting", description: "Allow users to post anonymously in lounge", enabled: true, category: "social" },
  { id: "ft-custom-quizzes", name: "Community Quizzes", description: "Allow students to create custom quizzes", enabled: true, category: "gamification" },
];

export function loadFeatures(): FeatureToggle[] {
  const activeClassroom = useClassroomStore.getState().activeClassroom;
  if (activeClassroom?.featureToggles && Array.isArray(activeClassroom.featureToggles)) {
    return activeClassroom.featureToggles;
  }
  return DEFAULT_FEATURES;
}

export async function saveFeatures(features: FeatureToggle[]) {
  const activeClassroom = useClassroomStore.getState().activeClassroom;
  if (!activeClassroom) return;

  try {
    const updated = await apiFetch(`/classrooms/${activeClassroom.id}/features`, {
      method: 'PUT',
      body: JSON.stringify(features),
    });
    
    // Update store
    useClassroomStore.getState().setActiveClassroom(updated);
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
  const features = activeClassroom?.featureToggles && Array.isArray(activeClassroom.featureToggles)
    ? activeClassroom.featureToggles
    : DEFAULT_FEATURES;
  
  return (features as FeatureToggle[]).find(f => f.id === id)?.enabled ?? false;
}
