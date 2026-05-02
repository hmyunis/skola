import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardDeadlineFeed, fetchSemesterInfo } from "@/services/api";
import { LiveStatusCard } from "@/components/LiveStatusCard";
import { PanicButton } from "@/components/PanicButton";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";
import { SurpriseAssessmentBanner } from "@/components/SurpriseAssessmentBanner";
import { useAuth } from "@/stores/authStore";
import { useSemesterStore } from "@/stores/semesterStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { useFeatureEnabled } from "@/services/features";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, CalendarClock, ClipboardList, FileText } from "lucide-react";

function parseSemesterDate(value: string): Date {
  const input = String(value || "").trim();
  if (!input) return new Date(Number.NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T12:00:00`);
  return new Date(input);
}

function getSemesterDisplayLabel(
  semester: { name?: string; semester: number } | null | undefined,
): string {
  if (!semester) return "Sem -";
  const configuredName = String(semester.name || "").trim();
  if (configuredName) return configuredName;
  return `Sem ${semester.semester}`;
}

function formatRelativeDue(daysUntilDue: number): string {
  if (daysUntilDue === 0) return "Today";
  if (daysUntilDue === 1) return "Tomorrow";
  return `In ${daysUntilDue}d`;
}

function formatDueDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const hasTime = /T\d{2}:\d{2}:\d{2}/.test(iso) && !iso.includes("T12:00:00.000Z");
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(hasTime
      ? {
          hour: "numeric" as const,
          minute: "2-digit" as const,
        }
      : {}),
  });
}

function DaysRemaining({ endDate }: { endDate: string }) {
  const [dateTooltipOpen, setDateTooltipOpen] = useState(false);
  if (!endDate) return <span className="tabular-nums font-black text-2xl">-</span>;
  const end = parseSemesterDate(endDate);
  if (Number.isNaN(end.getTime())) {
    return <span className="tabular-nums font-black text-2xl">-</span>;
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.max(0, Math.ceil((endDateOnly.getTime() - todayStart.getTime()) / 86_400_000));
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

  const semesterQuery = useQuery({
    queryKey: ["semester", activeClassroomId],
    queryFn: fetchSemesterInfo,
    enabled: !!activeClassroomId,
    retry: 1,
  });

  const feedQuery = useQuery({
    queryKey: ["dashboardDeadlineFeed", activeClassroomId, semId],
    queryFn: () => fetchDashboardDeadlineFeed({ limit: 10 }),
    enabled: !!activeClassroomId,
    retry: 1,
  });

  const thisWeekItems = useMemo(
    () => (feedQuery.data?.items || []).filter((item) => item.weekBucket === "this_week"),
    [feedQuery.data?.items],
  );
  const nextWeekItems = useMemo(
    () => (feedQuery.data?.items || []).filter((item) => item.weekBucket === "next_week"),
    [feedQuery.data?.items],
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Command Center</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Dashboard</h1>
        </div>
        {semesterQuery.data ? (
          <div className="flex items-baseline gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Semester</p>
              <p className="text-sm font-bold uppercase tracking-wide">
                {getSemesterDisplayLabel(semesterQuery.data)}
              </p>
            </div>
            <div className="border-l border-border pl-4 text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Days Left</p>
              <DaysRemaining endDate={semesterQuery.data.endDate} />
            </div>
          </div>
        ) : null}
      </div>

      {semesterQuery.isError && (
        <div className="border border-destructive/30 bg-destructive/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-destructive">
            {semesterQuery.error instanceof Error
              ? semesterQuery.error.message
              : "Could not load semester info."}
          </p>
          <Button variant="outline" size="sm" onClick={() => semesterQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}

      <LiveStatusCard />

      <SurpriseAssessmentBanner />

      <AnnouncementsBanner />

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <CardTitle className="text-xs">Remaining Classes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {feedQuery.isLoading ? (
              <div className="h-9 w-20 bg-muted animate-pulse" />
            ) : (
              <p className="text-3xl font-black tabular-nums">
                {feedQuery.isError ? "-" : (feedQuery.data?.quickStats.remainingClasses ?? 0)}
              </p>
            )}
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {feedQuery.isError ? "Unavailable" : "Today"}
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
            {feedQuery.isLoading ? (
              <div className="h-9 w-20 bg-muted animate-pulse" />
            ) : (
              <p className="text-3xl font-black tabular-nums">
                {feedQuery.isError ? "-" : (feedQuery.data?.quickStats.pendingAssignments ?? 0)}
              </p>
            )}
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {feedQuery.isError ? "Unavailable" : "Assignments"}
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
            {feedQuery.isLoading ? (
              <div className="h-9 w-20 bg-muted animate-pulse" />
            ) : (
              <p className="text-3xl font-black tabular-nums">
                {feedQuery.isError ? "-" : (feedQuery.data?.quickStats.upcomingExams ?? 0)}
              </p>
            )}
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {feedQuery.isError ? "Unavailable" : "This month"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">This Week + Next Week</CardTitle>
              </div>
              {!feedQuery.isLoading && !feedQuery.isError && (
                <p className="text-xs text-muted-foreground">
                  Showing {feedQuery.data?.meta.shownCount ?? 0} of {feedQuery.data?.meta.totalMatching ?? 0}
                </p>
              )}
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to="/academics">All Deadlines</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedQuery.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="border border-border rounded-sm p-3 space-y-2">
                  <div className="h-4 w-2/3 bg-muted animate-pulse" />
                  <div className="h-3 w-1/3 bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {feedQuery.isError && !feedQuery.isLoading && (
            <div className="border border-destructive/30 bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-destructive">
                {feedQuery.error instanceof Error
                  ? feedQuery.error.message
                  : "Could not load deadline feed."}
              </p>
              <Button variant="outline" size="sm" onClick={() => feedQuery.refetch()}>
                Retry
              </Button>
            </div>
          )}

          {!feedQuery.isLoading && !feedQuery.isError && (
            <>
              {feedQuery.data && feedQuery.data.meta.totalMatching === 0 ? (
                <div className="border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No upcoming deadlines in the next 2 weeks.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">This Week</p>
                    {thisWeekItems.length === 0 ? (
                      <div className="border border-dashed border-border p-3 text-xs text-muted-foreground">
                        No deadlines this week.
                      </div>
                    ) : (
                      thisWeekItems.map((item) => (
                        <div key={item.id} className="border border-border rounded-sm p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-semibold break-words">{item.title}</p>
                            <p className="text-xs text-muted-foreground break-words">
                              {item.courseCode ? `${item.courseCode} · ` : ""}
                              {formatDueDate(item.dueAt)}
                            </p>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-primary/40 bg-primary/10 text-primary shrink-0">
                            {formatRelativeDue(item.daysUntilDue)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Next Week</p>
                    {nextWeekItems.length === 0 ? (
                      <div className="border border-dashed border-border p-3 text-xs text-muted-foreground">
                        No deadlines next week.
                      </div>
                    ) : (
                      nextWeekItems.map((item) => (
                        <div key={item.id} className="border border-border rounded-sm p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-semibold break-words">{item.title}</p>
                            <p className="text-xs text-muted-foreground break-words">
                              {item.courseCode ? `${item.courseCode} · ` : ""}
                              {formatDueDate(item.dueAt)}
                            </p>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 border border-border bg-muted/30 text-muted-foreground shrink-0">
                            {formatRelativeDue(item.daysUntilDue)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {feedQuery.data && feedQuery.data.meta.remainingCount > 0 && (
                    <div className="border-t border-border pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        +{feedQuery.data.meta.remainingCount} more deadlines available.
                      </p>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/academics">View all in Academics</Link>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
