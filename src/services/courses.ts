import type { AdminCourse } from "@/types/admin";

// Re-export type for backward compatibility
export type { AdminCourse } from "@/types/admin";

const COURSES_KEY = "scola-admin-courses";

const DEFAULT_COURSES: AdminCourse[] = [
  { id: "c1", code: "CS301", name: "Data Structures & Algorithms", credits: 4, instructor: "Dr. Abebe Bekele", semesterId: "sem-2", enrolled: 68 },
  { id: "c2", code: "CS302", name: "Database Management Systems", credits: 4, instructor: "Prof. Hana Gebremedhin", semesterId: "sem-2", enrolled: 72 },
  { id: "c3", code: "CS303", name: "Computer Networks", credits: 3, instructor: "Dr. Mohammed Yusuf", semesterId: "sem-2", enrolled: 65 },
  { id: "c4", code: "CS304", name: "Operating Systems", credits: 4, instructor: "Prof. Tigist Alemu", semesterId: "sem-2", enrolled: 70 },
  { id: "c5", code: "MA201", name: "Engineering Mathematics", credits: 3, instructor: "Dr. Yonas Hailu", semesterId: "sem-2", enrolled: 120 },
  { id: "c6", code: "EC201", name: "Digital Electronics", credits: 3, instructor: "Dr. Fatima Ahmed", semesterId: "sem-2", enrolled: 55 },
];

export function loadCourses(): AdminCourse[] {
  try {
    const s = localStorage.getItem(COURSES_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_COURSES;
}

export function saveCourses(courses: AdminCourse[]) {
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
}
