import { useQuery } from "@tanstack/react-query";
import { fetchAnalytics } from "@/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart3,
  Users,
  MessageSquare,
  FolderOpen,
  Swords,
  TrendingUp,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AdminAnalytics = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["adminAnalytics"],
    queryFn: fetchAnalytics,
  });

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 space-y-5 max-w-5xl">
        <div className="border-b border-border pb-4">
          <div className="h-2.5 w-12 bg-muted animate-pulse mb-2" />
          <div className="h-7 w-36 bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border border-border p-3 space-y-2">
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 bg-muted animate-pulse" />
                <div className="h-2.5 w-16 bg-muted animate-pulse" />
              </div>
              <div className="h-7 w-12 bg-muted animate-pulse" />
            </div>
          ))}
        </div>
        <div className="border border-border p-4 space-y-3">
          <div className="h-2.5 w-24 bg-muted animate-pulse" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-8 bg-muted animate-pulse" />
              <div className="flex-1 h-5 bg-muted animate-pulse" />
              <div className="h-3 w-6 bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Admin</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Analytics</h1>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1"><Users className="h-3 w-3 text-primary" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Users</p></div>
          <p className="text-2xl font-black tabular-nums mt-1">{data.totalUsers}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1"><Activity className="h-3 w-3 text-emerald-500" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Active Today</p></div>
          <p className="text-2xl font-black tabular-nums mt-1">{data.activeToday}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1"><MessageSquare className="h-3 w-3 text-primary" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Posts</p></div>
          <p className="text-2xl font-black tabular-nums mt-1">{data.totalPosts.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1"><FolderOpen className="h-3 w-3 text-primary" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Resources</p></div>
          <p className="text-2xl font-black tabular-nums mt-1">{data.totalResources}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1"><Swords className="h-3 w-3 text-primary" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Quizzes</p></div>
          <p className="text-2xl font-black tabular-nums mt-1">{data.totalQuizzes}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500" /><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Engagement</p></div>
          <p className="text-2xl font-black tabular-nums mt-1">{data.engagementRate}%</p>
        </CardContent></Card>
      </div>

      {/* Weekly Activity */}
      <div className="border border-border p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Weekly Activity</p>
        <div className="space-y-2">
          {data.weeklyActivity.map((day) => {
            const total = day.posts + day.resources + day.quizzes;
            const maxTotal = Math.max(...data.weeklyActivity.map((d) => d.posts + d.resources + d.quizzes));
            const pct = (total / maxTotal) * 100;
            return (
              <div key={day.day} className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider w-8 text-muted-foreground">{day.day}</span>
                <div className="flex-1 h-5 bg-muted overflow-hidden flex">
                  <div className="h-full bg-primary/70 transition-all" style={{ width: `${(day.posts / total) * pct}%` }} />
                  <div className="h-full bg-emerald-500/70 transition-all" style={{ width: `${(day.resources / total) * pct}%` }} />
                  <div className="h-full bg-amber-500/70 transition-all" style={{ width: `${(day.quizzes / total) * pct}%` }} />
                </div>
                <span className="text-[10px] tabular-nums font-bold w-8 text-right">{total}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-primary/70" /> Posts</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500/70" /> Resources</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500/70" /> Quizzes</span>
        </div>
      </div>

      {/* Top Courses */}
      <div className="border border-border p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Top Courses by Engagement</p>
        <div className="space-y-2">
          {data.topCourses.map((course) => (
            <div key={course.code} className="flex items-center gap-3">
              <span className="text-xs font-bold w-14">{course.code}</span>
              <div className="flex-1 h-4 bg-muted overflow-hidden">
                <div className="h-full bg-primary/60 transition-all" style={{ width: `${course.engagement}%` }} />
              </div>
              <span className="text-xs tabular-nums font-bold w-10 text-right">{course.engagement}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* User Growth */}
      <div className="border border-border p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">User Growth</p>
        <div className="flex items-end gap-2 h-32">
          {data.userGrowth.map((month) => {
            const maxUsers = Math.max(...data.userGrowth.map((m) => m.users));
            const hPct = (month.users / maxUsers) * 100;
            return (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums font-bold text-muted-foreground">{month.users}</span>
                <div className="w-full bg-muted overflow-hidden flex-1 flex items-end">
                  <div className="w-full bg-primary/50 transition-all" style={{ height: `${hPct}%` }} />
                </div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">{month.month}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
