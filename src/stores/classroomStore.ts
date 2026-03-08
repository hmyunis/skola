import { create } from "zustand";
import type { Classroom } from "@/types/classroom";

const ACTIVE_KEY = "skola-active-classroom";

function loadActive(): Classroom | null {
  try {
    const s = localStorage.getItem(ACTIVE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return null;
}

interface ClassroomState {
  activeClassroom: Classroom | null;
  setActiveClassroom: (classroom: Classroom) => void;
  clearActiveClassroom: () => void;
}

export const useClassroomStore = create<ClassroomState>((set) => ({
  activeClassroom: loadActive(),

  setActiveClassroom: (classroom) => {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(classroom));
    set({ activeClassroom: classroom });
  },

  clearActiveClassroom: () => {
    localStorage.removeItem(ACTIVE_KEY);
    set({ activeClassroom: null });
  },
}));
