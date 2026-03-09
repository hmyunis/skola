import type { SemesterInfo, ClassSlot, QuickStats, Assignment, WeeklySchedule, Course } from "@/types/api";
import { useAuthStore } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";

// Re-export types for backward compatibility
export type { SemesterInfo, ClassSlot, QuickStats, Assignment, WeeklySchedule, Course, DayOfWeek } from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

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

const MOCK_SEMESTER_ID = "sem-2";

export async function fetchSemesterInfo(): Promise<SemesterInfo> {
  await delay(200);
  return { year: 3, semester: 2, startDate: "2026-01-15", endDate: "2026-05-30" };
}

export async function fetchTodaySchedule(semesterId?: string): Promise<ClassSlot[]> {
  await delay(300);
  if (semesterId && semesterId !== MOCK_SEMESTER_ID) return [];
  const now = new Date();
  const h = now.getHours();
  const today = (hour: number, minute: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);

  return [
    { id: "1", name: "Data Structures & Algorithms", code: "CS301", room: "Lab 302", type: "lecture", startTime: today(h - 1, 0), endTime: today(h, 30) },
    { id: "2", name: "Database Management Systems", code: "CS302", room: "Room 405", type: "lecture", startTime: today(h + 1, 0), endTime: today(h + 2, 0) },
    { id: "3", name: "Computer Networks Lab", code: "CS303", room: "Lab 201", type: "lab", startTime: today(h + 3, 0), endTime: today(h + 4, 30) },
    { id: "4", name: "Operating Systems", code: "CS304", room: "Room 110", type: "lecture", startTime: today(h + 5, 0), endTime: today(h + 6, 0) },
  ];
}

export async function fetchWeeklySchedule(semesterId?: string): Promise<WeeklySchedule> {
  await delay(400);
  if (semesterId && semesterId !== MOCK_SEMESTER_ID) return { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };
  const ref = new Date();
  const dayOffset = ref.getDay();
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - dayOffset + 1);

  const at = (dayIndex: number, hour: number, minute: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + dayIndex);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  return {
    Monday: [
      { id: "w1", name: "Data Structures & Algorithms", code: "CS301", room: "Room 301", type: "lecture", startTime: at(0, 9, 0), endTime: at(0, 10, 30) },
      { id: "w2", name: "Database Management Lab", code: "CS302", room: "Lab 204", type: "lab", startTime: at(0, 11, 0), endTime: at(0, 13, 0) },
      { id: "w3", name: "Operating Systems", code: "CS304", room: "Room 110", type: "lecture", startTime: at(0, 14, 0), endTime: at(0, 15, 0) },
    ],
    Tuesday: [
      { id: "w4", name: "Computer Networks", code: "CS303", room: "Room 205", type: "lecture", startTime: at(1, 8, 30), endTime: at(1, 10, 0) },
      { id: "w5", name: "DSA Lab", code: "CS301", room: "Lab 302", type: "lab", startTime: at(1, 10, 30), endTime: at(1, 12, 30) },
      { id: "w6", name: "Engineering Mathematics", code: "MA201", room: "Room 101", type: "lecture", startTime: at(1, 14, 0), endTime: at(1, 15, 30) },
    ],
    Wednesday: [
      { id: "w7", name: "Database Management Systems", code: "CS302", room: "Room 405", type: "lecture", startTime: at(2, 9, 0), endTime: at(2, 10, 0) },
      { id: "w8", name: "OS Lab", code: "CS304", room: "Lab 108", type: "lab", startTime: at(2, 11, 0), endTime: at(2, 13, 0) },
      { id: "w9", name: "CN Tutorial", code: "CS303", room: "Room 205", type: "lecture", startTime: at(2, 14, 30), endTime: at(2, 15, 30) },
    ],
    Thursday: [
      { id: "w10", name: "Data Structures & Algorithms", code: "CS301", room: "Room 301", type: "lecture", startTime: at(3, 9, 0), endTime: at(3, 10, 30) },
      { id: "w11", name: "Mathematics Tutorial", code: "MA201", room: "Room 101", type: "lecture", startTime: at(3, 11, 0), endTime: at(3, 12, 0) },
      { id: "w12", name: "Extra DSA Review", code: "CS301", room: "Room 301", type: "lecture", startTime: at(3, 14, 0), endTime: at(3, 15, 0), draft: true },
    ],
    Friday: [
      { id: "w13", name: "Computer Networks Lab", code: "CS303", room: "Lab 210", type: "lab", startTime: at(4, 9, 0), endTime: at(4, 11, 0) },
      { id: "w14", name: "Operating Systems", code: "CS304", room: "Room 110", type: "lecture", startTime: at(4, 11, 30), endTime: at(4, 13, 0) },
      { id: "w15", name: "Mid-Sem: DBMS", code: "CS302", room: "Exam Hall A", type: "exam", startTime: at(4, 14, 0), endTime: at(4, 16, 0) },
    ],
  };
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
