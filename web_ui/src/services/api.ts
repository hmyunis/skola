import type { SemesterInfo, ClassSlot, QuickStats, Assignment, WeeklySchedule, Course } from "@/types/api";
import { useAuthStore } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";

// Re-export types for backward compatibility
export type { SemesterInfo, ClassSlot, QuickStats, Assignment, WeeklySchedule, Course, DayOfWeek } from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const MOCK_SEMESTER_ID = "mock-semester-id";

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().accessToken;
  const activeClassroom = useClassroomStore.getState().activeClassroom;
  
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeClassroom ? { "x-classroom-id": activeClassroom.id } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "An error occurred" }));
    const apiError = new Error(error.message || "An error occurred") as any;
    apiError.status = response.status;
    apiError.data = error;
    throw apiError;
  }

  return response.json();
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Preconfigured course list */
export const COURSES: Course[] = [
  { code: "CS301", name: "Data Structures & Algorithms" },
  { code: "CS302", name: "Database Management Systems" },
  { code: "CS303", name: "Computer Networks" },
  { code: "CS304", name: "Operating Systems" },
  { code: "MA201", name: "Engineering Mathematics" },
  { code: "EC201", name: "Digital Electronics" },
  { code: "ME101", name: "Engineering Mechanics" },
  { code: "HU101", name: "Professional Ethics" },
];

export async function fetchSemesterInfo(): Promise<SemesterInfo> {
  const active = await apiFetch("/academics/semesters/active");
  return {
    year: active.year,
    semester: active.name.includes("2") ? 2 : 1, // Crude derivation or add to backend
    startDate: active.startDate,
    endDate: active.endDate,
  };
}

export async function fetchTodaySchedule(semesterId?: string): Promise<ClassSlot[]> {
  const schedule = await apiFetch("/academics/schedule");
  // Filter for today's day of week
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const today = days[new Date().getDay()];
  
  return schedule
    .filter((item: any) => item.dayOfWeek === today)
    .map((item: any) => ({
      id: item.id,
      name: item.course.name,
      code: item.course.code,
      room: item.room,
      type: item.type,
      startTime: new Date(`${new Date().toISOString().split('T')[0]}T${item.startTime}`),
      endTime: new Date(`${new Date().toISOString().split('T')[0]}T${item.endTime}`),
    }));
}

export async function fetchClassroom(classroomId: string): Promise<any> {
  return apiFetch(`/classrooms/${classroomId}`);
}

export async function fetchWeeklySchedule(semesterId?: string): Promise<WeeklySchedule> {
  const schedule = await apiFetch("/academics/schedule");
  const result: WeeklySchedule = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };
  
  schedule.forEach((item: any) => {
    if (result[item.dayOfWeek as keyof WeeklySchedule]) {
      result[item.dayOfWeek as keyof WeeklySchedule].push({
        id: item.id,
        name: item.course.name,
        code: item.course.code,
        room: item.room,
        type: item.type,
        startTime: new Date(`2000-01-01T${item.startTime}`), // Dummy date for time only
        endTime: new Date(`2000-01-01T${item.endTime}`),
      });
    }
  });
  
  return result;
}

export async function fetchQuickStats(semesterId?: string): Promise<QuickStats> {
  await delay(150);
  if (semesterId && semesterId !== MOCK_SEMESTER_ID) return { remainingClasses: 0, pendingAssignments: 0, upcomingExams: 0 };
  return { remainingClasses: 3, pendingAssignments: 5, upcomingExams: 2 };
}

export async function fetchAssignments(semesterId?: string): Promise<Assignment[]> {
  await delay(350);
  if (semesterId && semesterId !== MOCK_SEMESTER_ID) return [];
  return [
    { id: "a1", title: "Binary Tree Implementation", course: "CS301", dueDate: "2026-03-12", source: "classroom", status: "pending" },
    { id: "a2", title: "ER Diagram - Library System", course: "CS302", dueDate: "2026-03-14", source: "direct", status: "pending" },
    { id: "a3", title: "TCP/IP Analysis Report", course: "CS303", dueDate: "2026-03-10", source: "notice", status: "submitted" },
    { id: "a4", title: "Process Scheduling Simulation", course: "CS304", dueDate: "2026-03-18", source: "classroom", status: "pending" },
    { id: "a5", title: "SQL Query Optimization", course: "CS302", dueDate: "2026-03-20", source: "classroom", status: "pending" },
  ];
}
