/** Shared admin types — safe to import from backend monorepo */

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

export interface AdminCourse {
  id: string;
  code: string;
  name: string;
  credits: number;
  instructor: string;
  semesterId: string;
  enrolled: number;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin" | "owner";
  status: "active" | "banned" | "suspended";
  suspendedUntil?: string;
  joinedAt: string;
  lastActive: string;
  telegramUsername?: string;
}

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

export interface UserReport {
  id: string;
  type: FlaggedContent["type"];
  contentId: string;
  content: string;
  author: string;
  reason: string;
  reportedBy: string;
  reportedAt: string;
  status: "pending" | "resolved" | "dismissed";
}

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

export interface FeatureToggle {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "core" | "social" | "gamification" | "experimental";
}
