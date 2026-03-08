import { create } from "zustand";
import { loadSemesters, saveSemesters, type Semester } from "@/services/admin";

const ACTIVE_SEMESTER_KEY = "skola-active-semester-id";

function getInitialActiveSemester(semesters: Semester[]): Semester | null {
  // Try stored active semester
  try {
    const storedId = localStorage.getItem(ACTIVE_SEMESTER_KEY);
    if (storedId) {
      const found = semesters.find((s) => s.id === storedId);
      if (found) return found;
    }
  } catch {}
  // Fall back to first active semester, or first in list
  return semesters.find((s) => s.status === "active") || semesters[0] || null;
}

interface SemesterState {
  semesters: Semester[];
  activeSemester: Semester | null;
  setActiveSemester: (sem: Semester) => void;
  addSemester: (sem: Semester) => void;
  updateSemester: (sem: Semester) => void;
  deleteSemester: (id: string) => void;
  reload: () => void;
}

export const useSemesterStore = create<SemesterState>((set, get) => {
  const initial = loadSemesters();
  return {
    semesters: initial,
    activeSemester: getInitialActiveSemester(initial),

    setActiveSemester: (sem) => {
      localStorage.setItem(ACTIVE_SEMESTER_KEY, sem.id);
      set({ activeSemester: sem });
    },

    addSemester: (sem) => {
      const next = [sem, ...get().semesters];
      saveSemesters(next);
      set({ semesters: next });
    },

    updateSemester: (sem) => {
      const next = get().semesters.map((s) => (s.id === sem.id ? sem : s));
      saveSemesters(next);
      const active = get().activeSemester;
      set({
        semesters: next,
        activeSemester: active?.id === sem.id ? sem : active,
      });
    },

    deleteSemester: (id) => {
      const next = get().semesters.filter((s) => s.id !== id);
      saveSemesters(next);
      const active = get().activeSemester;
      set({
        semesters: next,
        activeSemester: active?.id === id
          ? (next.find((s) => s.status === "active") || next[0] || null)
          : active,
      });
    },

    reload: () => {
      const semesters = loadSemesters();
      set({ semesters, activeSemester: getInitialActiveSemester(semesters) });
    },
  };
});

/**
 * Returns a semester-scoped localStorage key.
 * All data storage should use this to namespace by semester.
 */
export function semesterKey(base: string, semesterId: string | undefined): string {
  return semesterId ? `${base}::${semesterId}` : base;
}
