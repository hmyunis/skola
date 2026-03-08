/** Multi-tenant classroom types */

export interface Classroom {
  id: string;
  name: string;
  code: string; // unique join code e.g. "SOFT-2025"
  batch: string;
  year: number;
  semester: number;
  ownerId: string;
  createdAt: string;
  memberCount: number;
}

export interface ClassMembership {
  userId: string;
  classroomId: string;
  role: "owner" | "admin" | "student";
  joinedAt: string;
}
