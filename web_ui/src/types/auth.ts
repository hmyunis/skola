/** Shared auth types — safe to import from backend monorepo */

export type UserRole = "student" | "admin" | "owner";

export interface MockAccount {
  id: string;
  name: string;
  email: string;
  initials: string;
  phone: string;
  role: UserRole;
  code: string;
  year: number;
  semester: number;
  batch: string;
  anonymous_id: string;
  telegramUsername: string;
}
