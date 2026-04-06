import type { SemesterInfo, ClassSlot, QuickStats, Assignment, WeeklySchedule, Course } from "@/types/api";
import { useAuthStore } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";

// Re-export types for backward compatibility
export type { SemesterInfo, ClassSlot, QuickStats, Assignment, WeeklySchedule, Course, DayOfWeek } from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const ISO_TIMESTAMP_WITH_ZONE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/i;
const ISO_TIMESTAMP_WITHOUT_ZONE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/;
const MYSQL_TIMESTAMP_WITHOUT_ZONE_RE =
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;

function normalizeServerTimestamp(value: string): string {
  if (ISO_TIMESTAMP_WITH_ZONE_RE.test(value)) {
    return value;
  }

  let normalizedCandidate: string | null = null;
  if (ISO_TIMESTAMP_WITHOUT_ZONE_RE.test(value)) {
    normalizedCandidate = `${value}Z`;
  } else if (MYSQL_TIMESTAMP_WITHOUT_ZONE_RE.test(value)) {
    normalizedCandidate = `${value.replace(" ", "T")}Z`;
  }

  if (!normalizedCandidate) {
    return value;
  }

  const parsed = new Date(normalizedCandidate);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

function normalizeUtcTimestamps<T>(value: T): T {
  if (typeof value === "string") {
    return normalizeServerTimestamp(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeUtcTimestamps(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const normalizedObject: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    normalizedObject[key] = normalizeUtcTimestamps(nestedValue);
  }

  return normalizedObject as T;
}

async function parseResponseBody(response: Response): Promise<any> {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const raw = await response.text();
  if (!raw) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return normalizeUtcTimestamps(JSON.parse(raw));
    } catch {
      return raw;
    }
  }

  try {
    return normalizeUtcTimestamps(JSON.parse(raw));
  } catch {
    return raw;
  }
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = useAuthStore.getState().accessToken;
  const activeClassroom = useClassroomStore.getState().activeClassroom;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeClassroom ? { "x-classroom-id": activeClassroom.id } : {}),
    ...((options.headers as Record<string, string> | undefined) || {}),
  };

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    const errorData = await parseResponseBody(response);
    const message =
      typeof errorData === "object" && errorData !== null && "message" in errorData
        ? String((errorData as { message?: unknown }).message || "An error occurred")
        : typeof errorData === "string" && errorData.trim()
          ? errorData
          : "An error occurred";
    const apiError = new Error(message) as any;
    apiError.status = response.status;
    apiError.data = errorData;
    throw apiError;
  }

  return parseResponseBody(response);
}

const WEEKDAY_BY_INDEX: Record<number, keyof WeeklySchedule> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

interface ScheduleItemApi {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  type: "lecture" | "lab" | "exam" | "other";
  location?: string | null;
  isOnline?: boolean;
  isDraft?: boolean;
  confirmedAt?: string | null;
  confirmedById?: string | null;
  fireMode?: "auto" | "on" | "off";
  course?: {
    id: string;
    name: string;
    code?: string;
  };
}

interface AssessmentApi {
  id: string;
  title: string;
  courseCode: string;
  dueDate: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "classroom" | "direct" | "notice" | "other";
  status?: "pending" | "submitted" | "graded";
  confidenceDistribution?: {
    confident: number;
    neutral: number;
    struggling: number;
    total: number;
  };
  confidencePercentages?: {
    confident: number;
    neutral: number;
    struggling: number;
  };
  userConfidence?: "confident" | "neutral" | "struggling" | null;
}

export interface AssignmentFilters {
  semesterId?: string;
  search?: string;
  courseCode?: string;
  status?: "pending" | "submitted" | "graded";
  source?: "classroom" | "direct" | "notice" | "other";
}

export interface AssessmentStats {
  total: number;
  pending: number;
  submitted: number;
  overdue: number;
}

function parseTimeToDate(date: Date, time: string): Date {
  const [hourStr = "0", minuteStr = "0", secondStr = "0"] = time.split(":");
  const d = new Date(date);
  d.setHours(Number(hourStr), Number(minuteStr), Number(secondStr), 0);
  return d;
}

function mapScheduleItemToClassSlot(item: ScheduleItemApi, baseDate: Date): ClassSlot {
  return {
    id: item.id,
    courseId: item.courseId,
    name: item.course?.name || "Untitled Course",
    code: item.course?.code || "N/A",
    room: item.location || (item.isOnline ? "Online" : "TBA"),
    type: item.type,
    dayOfWeek: item.dayOfWeek,
    startTime: parseTimeToDate(baseDate, item.startTime),
    endTime: parseTimeToDate(baseDate, item.endTime),
    draft: !!item.isDraft,
    confirmedAt: item.confirmedAt ? new Date(item.confirmedAt) : null,
    confirmedById: item.confirmedById ?? null,
    fireMode: item.fireMode || "auto",
  };
}

export async function fetchSemesterInfo(): Promise<SemesterInfo | null> {
  try {
    const active = await apiFetch("/academics/semesters/active");
    const semesterName = typeof active?.name === "string" ? active.name.trim() : "";
    const parsedSemester = Number(String(semesterName || "").match(/(?:sem(?:ester)?\s*)(\d+)/i)?.[1] || 0);

    return {
      name: semesterName || undefined,
      year: active.year,
      semester: parsedSemester || (semesterName.includes("2") ? 2 : 1), // Backward-compatible fallback.
      startDate: active.startDate,
      endDate: active.endDate,
    };
  } catch (error: any) {
    if (error?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function fetchTodaySchedule(semesterId?: string): Promise<ClassSlot[]> {
  void semesterId;
  let schedule: ScheduleItemApi[] = [];
  try {
    schedule = await apiFetch("/academics/schedule");
  } catch (error: any) {
    if (error?.status === 404) {
      return [];
    }
    throw error;
  }
  const today = new Date();
  const todayDay = today.getDay(); // 0 = Sunday ... 6 = Saturday

  return schedule
    .filter((item) => item.dayOfWeek === todayDay)
    .map((item) => mapScheduleItemToClassSlot(item, today))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export async function fetchClassroom(classroomId: string): Promise<any> {
  return apiFetch(`/classrooms/${classroomId}`);
}

export async function fetchWeeklySchedule(semesterId?: string): Promise<WeeklySchedule> {
  const result: WeeklySchedule = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };

  let schedule: ScheduleItemApi[] = [];
  try {
    schedule = await apiFetch("/academics/schedule");
  } catch (error: any) {
    if (error?.status === 404) {
      return result;
    }
    throw error;
  }
  
  (schedule as ScheduleItemApi[]).forEach((item) => {
    const day = WEEKDAY_BY_INDEX[item.dayOfWeek];
    if (day) {
      result[day].push(mapScheduleItemToClassSlot(item, new Date("2000-01-01T00:00:00")));
    }
  });

  Object.values(result).forEach((slots) => {
    slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  });
  
  return result;
}

export async function createScheduleItem(data: {
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  type: "lecture" | "lab" | "exam" | "other";
  location?: string;
  isOnline?: boolean;
  isDraft?: boolean;
  fireMode?: "auto" | "on" | "off";
}) {
  return apiFetch("/academics/schedule", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateScheduleItem(
  itemId: string,
  data: Partial<{
    courseId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    type: "lecture" | "lab" | "exam" | "other";
    location?: string;
    isOnline?: boolean;
    isDraft?: boolean;
    fireMode?: "auto" | "on" | "off";
  }>,
) {
  return apiFetch(`/academics/schedule/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteScheduleItem(itemId: string) {
  return apiFetch(`/academics/schedule/${itemId}`, { method: "DELETE" });
}

export async function publishScheduleDrafts(): Promise<{ updated: number }> {
  return apiFetch("/academics/schedule/publish", {
    method: "POST",
  });
}

export async function confirmScheduleItem(itemId: string) {
  return apiFetch(`/academics/schedule/${itemId}/confirm`, {
    method: "POST",
  });
}

export async function unconfirmScheduleItem(itemId: string) {
  return apiFetch(`/academics/schedule/${itemId}/unconfirm`, {
    method: "POST",
  });
}

export async function fetchQuickStats(semesterId?: string): Promise<QuickStats> {
  void semesterId;
  try {
    return await apiFetch("/academics/dashboard/quick-stats");
  } catch (error: any) {
    if (error?.status === 404) {
      return { remainingClasses: 0, pendingAssignments: 0, upcomingExams: 0 };
    }
    throw error;
  }
}

export async function fetchAssignments(filters?: AssignmentFilters): Promise<Assignment[]> {
  const params = new URLSearchParams();
  if (filters?.semesterId) params.set("semesterId", filters.semesterId);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.courseCode) params.set("courseCode", filters.courseCode);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.source) params.set("source", filters.source);
  const qs = params.toString();

  try {
    const assessments = await apiFetch(`/academics/assessments${qs ? `?${qs}` : ""}`);
    return (assessments as AssessmentApi[]).map((item) => ({
      id: item.id,
      title: item.title,
      course: item.courseCode,
      dueDate: item.dueDate ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      source: item.source || "classroom",
      status: item.status || "pending",
      confidenceDistribution: item.confidenceDistribution,
      confidencePercentages: item.confidencePercentages,
      userConfidence: item.userConfidence ?? null,
    }));
  } catch (error: any) {
    if (error?.status === 404) {
      return [];
    }
    throw error;
  }
}

export async function fetchAssessmentStats(filters?: AssignmentFilters): Promise<AssessmentStats> {
  const params = new URLSearchParams();
  if (filters?.semesterId) params.set("semesterId", filters.semesterId);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.courseCode) params.set("courseCode", filters.courseCode);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.source) params.set("source", filters.source);
  const qs = params.toString();

  try {
    return await apiFetch(`/academics/assessments/stats${qs ? `?${qs}` : ""}`);
  } catch (error: any) {
    if (error?.status === 404) {
      return { total: 0, pending: 0, submitted: 0, overdue: 0 };
    }
    throw error;
  }
}

export async function rateAssignmentConfidence(
  assignmentId: string,
  vote: "confident" | "neutral" | "struggling",
) {
  return apiFetch(`/academics/assessments/${assignmentId}/rating`, {
    method: "POST",
    body: JSON.stringify({ vote }),
  });
}

export async function clearAssignmentConfidence(assignmentId: string) {
  return apiFetch(`/academics/assessments/${assignmentId}/rating`, {
    method: "DELETE",
  });
}
