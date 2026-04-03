/** Multi-tenant classroom types */

export interface Classroom {
  id: string;
  name: string;
  telegramGroupId?: string;
  theme?: any;
  customThemes?: any[];
  code: string; // unique join code e.g. "SOFT-2025"
  batch: string;
  year: number;
  semester: number;
  ownerId: string;
  createdAt: string;
  memberCount: number;
  featureToggles?: any; // Store the array of FeatureToggle objects
}

export interface ClassMembership {
  userId: string;
  classroomId: string;
  role: "owner" | "admin" | "student";
  joinedAt: string;
}

export type ClassroomRole = "owner" | "admin" | "student";

export interface ClassroomMembershipContext {
  classroom: Classroom;
  role: ClassroomRole;
  joinedAt: string;
  status?: "active" | "suspended" | "banned";
  suspendedUntil?: string | null;
}
