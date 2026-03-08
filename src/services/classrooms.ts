import type { Classroom, ClassMembership } from "@/types/classroom";

const CLASSROOMS_KEY = "skola-classrooms";
const MEMBERSHIPS_KEY = "skola-memberships";

function load<T>(key: string): T[] {
  try {
    const s = localStorage.getItem(key);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

/** Generate a short, unique class code */
function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/* ── Classroom CRUD ── */

export function getClassrooms(): Classroom[] {
  return load<Classroom>(CLASSROOMS_KEY);
}

export function getClassroomByCode(code: string): Classroom | null {
  return getClassrooms().find((c) => c.code === code) ?? null;
}

export function getClassroomById(id: string): Classroom | null {
  return getClassrooms().find((c) => c.id === id) ?? null;
}

export function createClassroom(
  name: string,
  batch: string,
  year: number,
  semester: number,
  ownerId: string
): Classroom {
  const classrooms = getClassrooms();
  const classroom: Classroom = {
    id: `cls-${Date.now()}`,
    name,
    code: generateCode(),
    batch,
    year,
    semester,
    ownerId,
    createdAt: new Date().toISOString(),
    memberCount: 1,
  };
  classrooms.push(classroom);
  save(CLASSROOMS_KEY, classrooms);

  // Auto-add owner as member
  addMembership(ownerId, classroom.id, "owner");

  return classroom;
}

/* ── Membership ── */

export function getMemberships(): ClassMembership[] {
  return load<ClassMembership>(MEMBERSHIPS_KEY);
}

export function getUserClassrooms(userId: string): Classroom[] {
  const memberships = getMemberships().filter((m) => m.userId === userId);
  const classrooms = getClassrooms();
  return memberships
    .map((m) => classrooms.find((c) => c.id === m.classroomId))
    .filter(Boolean) as Classroom[];
}

export function getUserMembership(userId: string, classroomId: string): ClassMembership | null {
  return getMemberships().find((m) => m.userId === userId && m.classroomId === classroomId) ?? null;
}

export function addMembership(userId: string, classroomId: string, role: ClassMembership["role"]): ClassMembership {
  const memberships = getMemberships();
  const existing = memberships.find((m) => m.userId === userId && m.classroomId === classroomId);
  if (existing) return existing;

  const membership: ClassMembership = {
    userId,
    classroomId,
    role,
    joinedAt: new Date().toISOString(),
  };
  memberships.push(membership);
  save(MEMBERSHIPS_KEY, memberships);

  // Increment member count
  const classrooms = getClassrooms();
  const cls = classrooms.find((c) => c.id === classroomId);
  if (cls) {
    cls.memberCount++;
    save(CLASSROOMS_KEY, classrooms);
  }

  return membership;
}

export function joinClassByCode(code: string, userId: string): { success: boolean; classroom?: Classroom; error?: string } {
  const classroom = getClassroomByCode(code);
  if (!classroom) return { success: false, error: "Invalid class code. Please check and try again." };

  const existing = getUserMembership(userId, classroom.id);
  if (existing) return { success: false, error: "You're already a member of this class." };

  addMembership(userId, classroom.id, "student");
  return { success: true, classroom };
}
