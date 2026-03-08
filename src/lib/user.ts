// ─── Mock user identity ───
// In a real app, this would come from auth context
export const MOCK_USER_NAME = "Dawit Tadesse";
export const IS_ADMIN = true; // Current user has admin/moderator privileges
export const IS_OWNER = true; // Current user is the platform owner

export type UserRole = "student" | "admin" | "owner";

export function getCurrentRole(): UserRole {
  if (IS_OWNER) return "owner";
  if (IS_ADMIN) return "admin";
  return "student";
}
