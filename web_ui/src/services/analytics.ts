import type { AnalyticsData } from "@/types/admin";
import { apiFetch } from "./api";

// Re-export type for backward compatibility
export type { AnalyticsData } from "@/types/admin";

export async function fetchAnalytics(): Promise<AnalyticsData> {
  const data = await apiFetch("/admin/analytics");

  return {
    totalUsers: Number(data?.totalUsers || 0),
    activeToday: Number(data?.activeToday || 0),
    totalPosts: Number(data?.totalPosts || 0),
    totalResources: Number(data?.totalResources || 0),
    totalQuizzes: Number(data?.totalQuizzes || 0),
    avgDailyActive: Number(data?.avgDailyActive || 0),
    engagementRate: Number(data?.engagementRate || 0),
    topCourses: Array.isArray(data?.topCourses)
      ? data.topCourses.map((item: any) => ({
          code: String(item?.code || "N/A"),
          name: String(item?.name || "Unknown Course"),
          engagement: Number(item?.engagement || 0),
        }))
      : [],
    weeklyActivity: Array.isArray(data?.weeklyActivity)
      ? data.weeklyActivity.map((item: any) => ({
          day: String(item?.day || "N/A"),
          posts: Number(item?.posts || 0),
          resources: Number(item?.resources || 0),
          quizzes: Number(item?.quizzes || 0),
        }))
      : [],
    userGrowth: Array.isArray(data?.userGrowth)
      ? data.userGrowth.map((item: any) => ({
          month: String(item?.month || "N/A"),
          users: Number(item?.users || 0),
        }))
      : [],
  };
}
