import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSemesterInfo, fetchQuickStats } from "@/services/api";
import { LiveStatusCard } from "@/components/LiveStatusCard";
import { PanicButton } from "@/components/PanicButton";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";
import { SurpriseAssessmentBanner } from "@/components/SurpriseAssessmentBanner";
import { useAuth } from "@/stores/authStore";
import { useSemesterStore } from "@/stores/semesterStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { useFeatureEnabled } from "@/services/features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, FileText, ClipboardList } from "lucide-react";

function parseSemesterDate(value: string): Date {
  const input = String(value || "").trim();
  if (!input) return new Date(Number.NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    // Parse date-only strings in local time to avoid timezone day/year drift.
    return new Date(`${input}T12:00:00`);
  }
  return new Date(input);
}

function getSemesterYearLabel(
  semester: { year: number; startDate: string; endDate: string } | null | undefined,
): string {
  if (!semester) return "—";
  const start = parseSemesterDate(semester.startDate);
  const end = parseSemesterDate(semester.endDate);

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    return startYear === endYear ? String(startYear) : `${startYear}/${endYear}`;
  }

  if (!Number.isNaN(end.getTime())) {
    return String(end.getFullYear());
  }

  return String(semester.year ?? "—");
}

function DaysRemaining({ endDate }: { endDate: string }) {
  const [dateTooltipOpen, setDateTooltipOpen] = useState(false);
  if (!endDate) return <span className="tabular-nums font-black text-2xl">—</span>;
  const end = parseSemesterDate(endDate);
  if (Number.isNaN(end.getTime())) {
    return <span className="tabular-nums font-black text-2xl">—</span>;
  }
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.max(0, Math.ceil((endDateOnly.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24)));
  const exactDateLabel = endDateOnly.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Tooltip
      open={dateTooltipOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setDateTooltipOpen(false);
      }}
    >
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setDateTooltipOpen((prev) => !prev)}
          className="tabular-nums font-black text-2xl leading-none text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Days left: ${diff}. Click to view exact end date.`}
        >
          {diff}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span>{exactDateLabel}</span>
      </TooltipContent>
    </Tooltip>
  );
}

const Index = () => {
  const { isAdmin } = useAuth();
  const panicEnabled = useFeatureEnabled("ft-panic");
  const semId = useSemesterStore((s) => s.activeSemester?.id);
  const activeClassroomId = useClassroomStore((s) => s.activeClassroom?.id);

  const {
    data: semester,
    isLoading: semLoading,
    isError: semError,
    error: semErrorObj,
    refetch: refetchSemester,
  } = useQuery({
    queryKey: ["semester", activeClassroomId],
    queryFn: fetchSemesterInfo,
    enabled: !!activeClassroomId,
    retry: 1,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErrorObj,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["quickStats", activeClassroomId, semId],
    queryFn: () => fetchQuickStats(semId),
    enabled: !!activeClassroomId,
    retry: 1,
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
                Year {getSemesterYearLabel(semester)}, Sem {semester.semester}
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
        {!semLoading && !semester && !semError && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Semester
            </p>
            <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              No active semester
            </p>
          </div>
        )}
        {semLoading && (
          <div className="space-y-1">
            <div className="h-3 w-24 bg-muted animate-pulse" />
            <div className="h-8 w-44 bg-muted animate-pulse" />
          </div>
        )}
        {semError && (
          <div className="text-right space-y-2">
            <p className="text-xs text-destructive">
              {semErrorObj instanceof Error ? semErrorObj.message : "Could not load semester info."}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchSemester()}>
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* Live Status */}
      <LiveStatusCard />

      {/* Surprise Assessment Alarm (Class-wide) */}
      <SurpriseAssessmentBanner />

      {/* Announcements */}
      <AnnouncementsBanner />

      {/* Admin Panic Button */}
      {isAdmin && panicEnabled && (
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
      {statsError && (
        <div className="border border-destructive/30 bg-destructive/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-destructive">
            {statsErrorObj instanceof Error ? statsErrorObj.message : "Could not load quick stats."}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetchStats()}>
            Retry
          </Button>
        </div>
      )}
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
              {statsLoading ? "..." : statsError ? "—" : (stats?.remainingClasses ?? 0)}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {statsError ? "Unavailable" : "Today"}
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
              {statsLoading ? "..." : statsError ? "—" : (stats?.pendingAssignments ?? 0)}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {statsError ? "Unavailable" : "Assignments"}
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
              {statsLoading ? "..." : statsError ? "—" : (stats?.upcomingExams ?? 0)}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {statsError ? "Unavailable" : "This month"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
