/** Shared API types — safe to import from backend monorepo */

export interface SemesterInfo {
  year: number;
  semester: number;
  startDate: string;
  endDate: string;
}

export interface ClassSlot {
  id: string;
  name: string;
  code: string;
  room: string;
  type: "lecture" | "lab" | "exam";
  startTime: Date;
  endTime: Date;
  draft?: boolean;
}

export interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: string;
  source: "classroom" | "direct" | "notice";
  status: "pending" | "submitted" | "graded";
}

export interface QuickStats {
  remainingClasses: number;
  pendingAssignments: number;
  upcomingExams: number;
}

export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";

export interface WeeklySchedule {
  [key: string]: ClassSlot[];
}

export interface Course {
  code: string;
  name: string;
}
