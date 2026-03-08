const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Semester Management ───
export interface Semester {
  id: string;
  name: string;
  year: number;
  term: number;
  startDate: string;
  endDate: string;
  status: "active" | "upcoming" | "archived";
  examPeriod?: { start: string; end: string };
  breaks?: { name: string; start: string; end: string }[];
}

const SEMESTERS_KEY = "scola-admin-semesters";

const DEFAULT_SEMESTERS: Semester[] = [
  {
    id: "sem-1",
    name: "Fall 2025",
    year: 2025,
    term: 1,
    startDate: "2025-08-15",
    endDate: "2025-12-20",
    status: "archived",
    examPeriod: { start: "2025-12-01", end: "2025-12-18" },
    breaks: [{ name: "Mid-Term Break", start: "2025-10-10", end: "2025-10-14" }],
  },
  {
    id: "sem-2",
    name: "Spring 2026",
    year: 2026,
    term: 2,
    startDate: "2026-01-15",
    endDate: "2026-05-30",
    status: "active",
    examPeriod: { start: "2026-05-10", end: "2026-05-28" },
    breaks: [
      { name: "Spring Break", start: "2026-03-20", end: "2026-03-27" },
    ],
  },
  {
    id: "sem-3",
    name: "Fall 2026",
    year: 2026,
    term: 1,
    startDate: "2026-08-15",
    endDate: "2026-12-20",
    status: "upcoming",
  },
];

export function loadSemesters(): Semester[] {
  try {
    const s = localStorage.getItem(SEMESTERS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_SEMESTERS;
}

export function saveSemesters(semesters: Semester[]) {
  localStorage.setItem(SEMESTERS_KEY, JSON.stringify(semesters));
}

// ─── Course Management ───
export interface AdminCourse {
  id: string;
  code: string;
  name: string;
  credits: number;
  instructor: string;
  semesterId: string;
  enrolled: number;
}

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

// ─── User Management ───
export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin" | "owner";
  status: "active" | "banned" | "suspended";
  joinedAt: string;
  lastActive: string;
}

export async function fetchManagedUsers(): Promise<ManagedUser[]> {
  await delay(300);
  return [
    { id: "u1", name: "Dawit Tadesse", email: "dawit@scola.edu", role: "owner", status: "active", joinedAt: "2025-06-01", lastActive: "2026-03-08" },
    { id: "u2", name: "Meron Kebede", email: "meron@scola.edu", role: "admin", status: "active", joinedAt: "2025-08-15", lastActive: "2026-03-07" },
    { id: "u3", name: "Bereket Wolde", email: "bereket@scola.edu", role: "student", status: "active", joinedAt: "2025-08-20", lastActive: "2026-03-08" },
    { id: "u4", name: "Amina Hassan", email: "amina@scola.edu", role: "student", status: "active", joinedAt: "2025-09-01", lastActive: "2026-03-06" },
    { id: "u5", name: "Nahom Tesfaye", email: "nahom@scola.edu", role: "student", status: "suspended", joinedAt: "2025-09-10", lastActive: "2026-02-28" },
    { id: "u6", name: "Sara Mohammed", email: "sara@scola.edu", role: "student", status: "banned", joinedAt: "2025-10-05", lastActive: "2026-01-15" },
    { id: "u7", name: "Kidus Mengistu", email: "kidus@scola.edu", role: "admin", status: "active", joinedAt: "2025-08-10", lastActive: "2026-03-08" },
    { id: "u8", name: "Liya Abdi", email: "liya@scola.edu", role: "student", status: "active", joinedAt: "2025-11-01", lastActive: "2026-03-07" },
  ];
}

// ─── Content Moderation ───
export interface FlaggedContent {
  id: string;
  type: "post" | "resource" | "quiz" | "reply";
  content: string;
  author: string;
  reason: string;
  reportedBy: string;
  reportedAt: string;
  status: "pending" | "resolved" | "dismissed";
}

export async function fetchFlaggedContent(): Promise<FlaggedContent[]> {
  await delay(300);
  return [
    { id: "f1", type: "post", content: "Extremely inappropriate comment about a professor...", author: "Anon#6120", reason: "Harassment", reportedBy: "Anon#4821", reportedAt: "2026-03-07T14:30:00", status: "pending" },
    { id: "f2", type: "resource", content: "Uploaded copyrighted textbook PDF", author: "Bereket Wolde", reason: "Copyright violation", reportedBy: "Meron Kebede", reportedAt: "2026-03-06T10:15:00", status: "pending" },
    { id: "f3", type: "reply", content: "Spam link to external website", author: "Anon#9012", reason: "Spam", reportedBy: "Anon#2156", reportedAt: "2026-03-05T18:45:00", status: "resolved" },
    { id: "f4", type: "quiz", content: "Quiz with offensive question content", author: "Anon#3367", reason: "Offensive content", reportedBy: "Anon#7733", reportedAt: "2026-03-04T09:20:00", status: "dismissed" },
    { id: "f5", type: "post", content: "Sharing exam answers openly in the lounge", author: "Anon#5544", reason: "Academic dishonesty", reportedBy: "Anon#8891", reportedAt: "2026-03-08T08:00:00", status: "pending" },
  ];
}

// ─── Announcements ───
export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  createdAt: string;
  expiresAt?: string;
  createdBy: string;
  targetAudience: "all" | "students" | "admins";
  pinned: boolean;
}

const ANNOUNCEMENTS_KEY = "scola-admin-announcements";

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  { id: "a1", title: "Mid-Semester Examination Schedule Released", content: "The mid-semester examination schedule for Spring 2026 has been published. Please check your schedule page for details.", priority: "high", createdAt: "2026-03-01T09:00:00", expiresAt: "2026-03-20", createdBy: "Arjun Patel", targetAudience: "all", pinned: true },
  { id: "a2", title: "Lab 302 Maintenance", content: "Lab 302 will be unavailable for maintenance on March 10-11. All lab sessions will be relocated to Lab 204.", priority: "normal", createdAt: "2026-03-05T14:00:00", expiresAt: "2026-03-12", createdBy: "Riya Sharma", targetAudience: "students", pinned: false },
  { id: "a3", title: "Spring Break Reminder", content: "Spring break is from March 20-27. Campus facilities will operate on reduced hours.", priority: "low", createdAt: "2026-03-08T08:00:00", createdBy: "Arjun Patel", targetAudience: "all", pinned: false },
];

export function loadAnnouncements(): Announcement[] {
  try {
    const s = localStorage.getItem(ANNOUNCEMENTS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_ANNOUNCEMENTS;
}

export function saveAnnouncements(announcements: Announcement[]) {
  localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(announcements));
}

// ─── Analytics ───
export interface AnalyticsData {
  totalUsers: number;
  activeToday: number;
  totalPosts: number;
  totalResources: number;
  totalQuizzes: number;
  avgDailyActive: number;
  engagementRate: number;
  topCourses: { code: string; name: string; engagement: number }[];
  weeklyActivity: { day: string; posts: number; resources: number; quizzes: number }[];
  userGrowth: { month: string; users: number }[];
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  await delay(400);
  return {
    totalUsers: 248,
    activeToday: 89,
    totalPosts: 1247,
    totalResources: 342,
    totalQuizzes: 56,
    avgDailyActive: 73,
    engagementRate: 67,
    topCourses: [
      { code: "CS301", name: "Data Structures", engagement: 92 },
      { code: "CS304", name: "Operating Systems", engagement: 87 },
      { code: "CS302", name: "DBMS", engagement: 81 },
      { code: "CS303", name: "Networks", engagement: 74 },
    ],
    weeklyActivity: [
      { day: "Mon", posts: 45, resources: 12, quizzes: 8 },
      { day: "Tue", posts: 52, resources: 15, quizzes: 6 },
      { day: "Wed", posts: 38, resources: 8, quizzes: 10 },
      { day: "Thu", posts: 61, resources: 18, quizzes: 12 },
      { day: "Fri", posts: 33, resources: 10, quizzes: 5 },
      { day: "Sat", posts: 18, resources: 4, quizzes: 3 },
      { day: "Sun", posts: 22, resources: 6, quizzes: 4 },
    ],
    userGrowth: [
      { month: "Oct", users: 45 },
      { month: "Nov", users: 82 },
      { month: "Dec", users: 120 },
      { month: "Jan", users: 168 },
      { month: "Feb", users: 215 },
      { month: "Mar", users: 248 },
    ],
  };
}

// ─── Feature Toggles (Owner) ───
export interface FeatureToggle {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "core" | "social" | "gamification" | "experimental";
}

const FEATURES_KEY = "scola-owner-features";

const DEFAULT_FEATURES: FeatureToggle[] = [
  { id: "ft-schedule", name: "Schedule", description: "Class schedule and timetable management", enabled: true, category: "core" },
  { id: "ft-academics", name: "Academics", description: "Grades, assignments, and academic tracking", enabled: true, category: "core" },
  { id: "ft-resources", name: "Resources", description: "Shared study materials and file hub", enabled: true, category: "core" },
  { id: "ft-lounge", name: "Lounge", description: "Anonymous social feed for students", enabled: true, category: "social" },
  { id: "ft-arena", name: "Arena", description: "Gamified quiz battles and leaderboards", enabled: true, category: "gamification" },
  { id: "ft-panic", name: "Surprise Assessment", description: "The panic button easter egg", enabled: true, category: "experimental" },
  { id: "ft-anon-posting", name: "Anonymous Posting", description: "Allow users to post anonymously in lounge", enabled: true, category: "social" },
  { id: "ft-custom-quizzes", name: "Community Quizzes", description: "Allow students to create custom quizzes", enabled: true, category: "gamification" },
];

export function loadFeatures(): FeatureToggle[] {
  try {
    const s = localStorage.getItem(FEATURES_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return DEFAULT_FEATURES;
}

export function saveFeatures(features: FeatureToggle[]) {
  localStorage.setItem(FEATURES_KEY, JSON.stringify(features));
}
