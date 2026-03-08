const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

export async function fetchSemesterInfo(): Promise<SemesterInfo> {
  await delay(200);
  return {
    year: 3,
    semester: 2,
    startDate: "2026-01-15",
    endDate: "2026-05-30",
  };
}

export async function fetchTodaySchedule(): Promise<ClassSlot[]> {
  await delay(300);
  const now = new Date();
  const h = now.getHours();
  const today = (hour: number, minute: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);

  return [
    {
      id: "1",
      name: "Data Structures & Algorithms",
      code: "CS301",
      room: "Lab 302",
      type: "lecture",
      startTime: today(h - 1, 0),
      endTime: today(h, 30),
    },
    {
      id: "2",
      name: "Database Management Systems",
      code: "CS302",
      room: "Room 405",
      type: "lecture",
      startTime: today(h + 1, 0),
      endTime: today(h + 2, 0),
    },
    {
      id: "3",
      name: "Computer Networks Lab",
      code: "CS303",
      room: "Lab 201",
      type: "lab",
      startTime: today(h + 3, 0),
      endTime: today(h + 4, 30),
    },
    {
      id: "4",
      name: "Operating Systems",
      code: "CS304",
      room: "Room 110",
      type: "lecture",
      startTime: today(h + 5, 0),
      endTime: today(h + 6, 0),
    },
  ];
}

export async function fetchQuickStats(): Promise<QuickStats> {
  await delay(150);
  return {
    remainingClasses: 3,
    pendingAssignments: 5,
    upcomingExams: 2,
  };
}

export async function fetchAssignments(): Promise<Assignment[]> {
  await delay(350);
  return [
    { id: "a1", title: "Binary Tree Implementation", course: "CS301", dueDate: "2026-03-12", source: "classroom", status: "pending" },
    { id: "a2", title: "ER Diagram - Library System", course: "CS302", dueDate: "2026-03-14", source: "direct", status: "pending" },
    { id: "a3", title: "TCP/IP Analysis Report", course: "CS303", dueDate: "2026-03-10", source: "notice", status: "submitted" },
    { id: "a4", title: "Process Scheduling Simulation", course: "CS304", dueDate: "2026-03-18", source: "classroom", status: "pending" },
    { id: "a5", title: "SQL Query Optimization", course: "CS302", dueDate: "2026-03-20", source: "classroom", status: "pending" },
  ];
}
