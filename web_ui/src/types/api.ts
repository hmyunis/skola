/** Shared API types — safe to import from backend monorepo */

export interface SemesterInfo {
  name?: string;
  year: number;
  semester: number;
  startDate: string;
  endDate: string;
}

export interface ClassSlot {
  id: string;
  courseId?: string;
  name: string;
  code: string;
  room: string;
  type: "lecture" | "lab" | "exam" | "other";
  dayOfWeek?: number;
  startTime: Date;
  endTime: Date;
  draft?: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: string | null;
  source: "classroom" | "direct" | "notice" | "other";
  status: "pending" | "submitted" | "graded";
  createdAt?: string;
  updatedAt?: string;
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

export interface QuickStats {
  remainingClasses: number;
  pendingAssignments: number;
  upcomingExams: number;
}

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface WeeklySchedule {
  [key: string]: ClassSlot[];
}

export interface Course {
  code: string;
  name: string;
}
