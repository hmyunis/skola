import type { AnalyticsData } from "@/types/admin";

// Re-export type for backward compatibility
export type { AnalyticsData } from "@/types/admin";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
