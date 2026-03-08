import { useQuery } from "@tanstack/react-query";
import { fetchSemesterInfo, fetchQuickStats } from "@/services/api";
import { LiveStatusCard } from "@/components/LiveStatusCard";
import { PanicButton } from "@/components/PanicButton";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FileText, ClipboardList } from "lucide-react";

function DaysRemaining({ endDate }: { endDate: string }) {
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  return (
    <span className="tabular-nums font-black text-2xl">{diff}</span>
  );
}

const Index = () => {
  const { isAdmin } = useAuth();

  const { data: semester, isLoading: semLoading } = useQuery({
    queryKey: ["semester"],
    queryFn: fetchSemesterInfo,
  });

  const { data: stats } = useQuery({
    queryKey: ["quickStats"],
    queryFn: fetchQuickStats,
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Semester header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
            Command Center
          </p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">
            Dashboard
          </h1>
        </div>
        {semester && (
          <div className="flex items-baseline gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Semester
              </p>
              <p className="text-sm font-bold uppercase tracking-wide">
                Year {semester.year}, Sem {semester.semester}
              </p>
            </div>
            <div className="border-l border-border pl-4 text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Days Left
              </p>
              <DaysRemaining endDate={semester.endDate} />
            </div>
          </div>
        )}
        {semLoading && (
          <div className="space-y-1">
            <div className="h-3 w-24 bg-muted animate-pulse" />
            <div className="h-8 w-44 bg-muted animate-pulse" />
          </div>
        )}
      </div>

      {/* Live Status */}
      <LiveStatusCard />

      {/* Announcements */}
      <AnnouncementsBanner />

      {/* Admin Panic Button */}
      {isAdmin && (
        <div className="border border-dashed border-destructive/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-destructive font-bold">
              Admin Only
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Trigger an emergency assessment notification
            </p>
          </div>
          <PanicButton />
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <CardTitle className="text-xs">Remaining Classes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black tabular-nums">
              {stats?.remainingClasses ?? "—"}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              Today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-xs">Pending Work</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black tabular-nums">
              {stats?.pendingAssignments ?? "—"}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              Assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-destructive" />
              <CardTitle className="text-xs">Upcoming Exams</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black tabular-nums">
              {stats?.upcomingExams ?? "—"}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              This month
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
