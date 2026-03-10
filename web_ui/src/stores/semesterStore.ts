import { create } from "zustand";
import { 
  loadSemesters, 
  createSemester, 
  updateSemester as apiUpdateSemester, 
  deleteSemester as apiDeleteSemester,
  type Semester 
} from "@/services/admin";

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
  isLoading: boolean;
  error: string | null;
  setActiveSemester: (sem: Semester) => void;
  addSemester: (sem: Omit<Semester, "id">) => Promise<void>;
  updateSemester: (sem: Semester) => Promise<void>;
  deleteSemester: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

export const useSemesterStore = create<SemesterState>((set, get) => ({
  semesters: [],
  activeSemester: null,
  isLoading: false,
  error: null,

  setActiveSemester: (sem) => {
    localStorage.setItem(ACTIVE_SEMESTER_KEY, sem.id);
    set({ activeSemester: sem });
  },

  addSemester: async (sem) => {
    set({ isLoading: true, error: null });
    try {
      const newSem = await createSemester(sem);
      set((state) => ({
        semesters: [newSem, ...state.semesters],
        isLoading: false
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateSemester: async (sem) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await apiUpdateSemester(sem.id, sem);
      set((state) => {
        const next = state.semesters.map((s) => (s.id === updated.id ? updated : s));
        const active = state.activeSemester;
        return {
          semesters: next,
          activeSemester: active?.id === updated.id ? updated : active,
          isLoading: false
        };
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  deleteSemester: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await apiDeleteSemester(id);
      set((state) => {
        const next = state.semesters.filter((s) => s.id !== id);
        const active = state.activeSemester;
        return {
          semesters: next,
          activeSemester: active?.id === id
            ? (next.find((s) => s.status === "active") || next[0] || null)
            : active,
          isLoading: false
        };
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  reload: async () => {
    set({ isLoading: true, error: null });
    try {
      const semesters = await loadSemesters();
      set({ 
        semesters, 
        activeSemester: getInitialActiveSemester(semesters),
        isLoading: false 
      });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
}));

/**
 * Returns a semester-scoped localStorage key.
 * All data storage should use this to namespace by semester.
 */
export function semesterKey(base: string, semesterId: string | undefined): string {
  return semesterId ? `${base}::${semesterId}` : base;
}
