import type { FeatureToggle } from "@/types/admin";

// Re-export type for backward compatibility
export type { FeatureToggle } from "@/types/admin";

const FEATURES_KEY = "skola-owner-features";

const DEFAULT_FEATURES: FeatureToggle[] = [
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
  try {
    const s = localStorage.getItem(FEATURES_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_FEATURES;
}

export function saveFeatures(features: FeatureToggle[]) {
  localStorage.setItem(FEATURES_KEY, JSON.stringify(features));
}
