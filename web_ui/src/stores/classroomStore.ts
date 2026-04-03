import { create } from "zustand";
import type { Classroom, ClassroomMembershipContext, ClassroomRole } from "@/types/classroom";

const ACTIVE_KEY = "skola-active-classroom";
const ACTIVE_ROLE_KEY = "skola-active-classroom-role";
const MEMBERSHIPS_KEY = "skola-classroom-memberships";
const REMEMBERED_KEY = "skola-remembered-classroom-id";

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
  return null;
}

function loadString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persistJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

interface ClassroomState {
  memberships: ClassroomMembershipContext[];
  activeClassroom: Classroom | null;
  activeClassroomRole: ClassroomRole | null;
  rememberedClassroomId: string | null;
  setMemberships: (memberships: ClassroomMembershipContext[]) => void;
  setActiveClassroom: (classroom: Classroom, role?: ClassroomRole | null) => void;
  setActiveClassroomById: (classroomId: string) => void;
  setRememberedClassroomId: (classroomId: string | null) => void;
  clearActiveClassroom: () => void;
  clearContext: () => void;
}

function pickInitialActiveClassroom(
  memberships: ClassroomMembershipContext[],
  currentActive: Classroom | null,
  rememberedClassroomId: string | null,
): { classroom: Classroom | null; role: ClassroomRole | null } {
  if (!memberships.length) return { classroom: null, role: null };

  const byCurrent = currentActive
    ? memberships.find((membership) => membership.classroom.id === currentActive.id)
    : null;
  if (byCurrent) {
    return { classroom: byCurrent.classroom, role: byCurrent.role };
  }

  const byRemembered = rememberedClassroomId
    ? memberships.find((membership) => membership.classroom.id === rememberedClassroomId)
    : null;
  if (byRemembered) {
    return { classroom: byRemembered.classroom, role: byRemembered.role };
  }

  const fallback = memberships[0];
  return { classroom: fallback.classroom, role: fallback.role };
}

export const useClassroomStore = create<ClassroomState>((set, get) => ({
  memberships: loadJson<ClassroomMembershipContext[]>(MEMBERSHIPS_KEY) || [],
  activeClassroom: loadJson<Classroom>(ACTIVE_KEY),
  activeClassroomRole: loadJson<ClassroomRole>(ACTIVE_ROLE_KEY),
  rememberedClassroomId: loadString(REMEMBERED_KEY),

  setMemberships: (memberships) => {
    const safeMemberships = Array.isArray(memberships) ? memberships : [];
    persistJson(MEMBERSHIPS_KEY, safeMemberships);

    const { activeClassroom, rememberedClassroomId } = get();
    const { classroom, role } = pickInitialActiveClassroom(
      safeMemberships,
      activeClassroom,
      rememberedClassroomId,
    );

    if (classroom) {
      persistJson(ACTIVE_KEY, classroom);
      persistJson(ACTIVE_ROLE_KEY, role);
      localStorage.setItem(REMEMBERED_KEY, classroom.id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
      localStorage.removeItem(ACTIVE_ROLE_KEY);
    }

    set({
      memberships: safeMemberships,
      activeClassroom: classroom,
      activeClassroomRole: role,
      rememberedClassroomId: classroom?.id || rememberedClassroomId || null,
    });
  },

  setActiveClassroom: (classroom, role) => {
    const memberships = get().memberships;
    const matchedMembership = memberships.find((membership) => membership.classroom.id === classroom.id);
    const resolvedRole = role ?? matchedMembership?.role ?? get().activeClassroomRole ?? null;

    persistJson(ACTIVE_KEY, classroom);
    persistJson(ACTIVE_ROLE_KEY, resolvedRole);
    localStorage.setItem(REMEMBERED_KEY, classroom.id);

    set({
      activeClassroom: classroom,
      activeClassroomRole: resolvedRole,
      rememberedClassroomId: classroom.id,
    });
  },

  setActiveClassroomById: (classroomId) => {
    const membership = get().memberships.find((item) => item.classroom.id === classroomId);
    if (!membership) return;

    persistJson(ACTIVE_KEY, membership.classroom);
    persistJson(ACTIVE_ROLE_KEY, membership.role);
    localStorage.setItem(REMEMBERED_KEY, classroomId);

    set({
      activeClassroom: membership.classroom,
      activeClassroomRole: membership.role,
      rememberedClassroomId: classroomId,
    });
  },

  setRememberedClassroomId: (classroomId) => {
    if (classroomId) {
      localStorage.setItem(REMEMBERED_KEY, classroomId);
    } else {
      localStorage.removeItem(REMEMBERED_KEY);
    }
    set({ rememberedClassroomId: classroomId });
  },

  clearActiveClassroom: () => {
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(ACTIVE_ROLE_KEY);
    set({ activeClassroom: null, activeClassroomRole: null });
  },

  clearContext: () => {
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(ACTIVE_ROLE_KEY);
    localStorage.removeItem(MEMBERSHIPS_KEY);
    localStorage.removeItem(REMEMBERED_KEY);
    set({
      memberships: [],
      activeClassroom: null,
      activeClassroomRole: null,
      rememberedClassroomId: null,
    });
  },
}));
