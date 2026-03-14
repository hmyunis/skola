import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTodaySchedule, type ClassSlot } from "@/services/api";
import { useSemesterStore } from "@/stores/semesterStore";
import { useAuth } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Coffee, Loader2 } from "lucide-react";
import { formatTime12 } from "@/lib/utils";

type LiveState =
  | { status: "live"; classSlot: ClassSlot; progress: number; remaining: string }
  | { status: "upcoming"; classSlot: ClassSlot; startsIn: string }
  | { status: "free" };

const EMPTY_SCHEDULE: ClassSlot[] = [];

function computeState(schedule: ClassSlot[]): LiveState {
  const now = new Date();

  for (const slot of schedule) {
    if (now >= slot.startTime && now <= slot.endTime) {
      const elapsed = now.getTime() - slot.startTime.getTime();
      const total = slot.endTime.getTime() - slot.startTime.getTime();
      const progress = Math.min(100, (elapsed / total) * 100);
      const remainMs = slot.endTime.getTime() - now.getTime();
      const remainMin = Math.ceil(remainMs / 60000);
      return {
        status: "live",
        classSlot: slot,
        progress,
        remaining: `${remainMin}m remaining`,
      };
    }
  }

  const upcoming = schedule
    .filter((s) => s.startTime > now)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const diffMs = next.startTime.getTime() - now.getTime();
    const diffMin = Math.ceil(diffMs / 60000);
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return {
      status: "upcoming",
      classSlot: next,
      startsIn: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
    };
  }

  return { status: "free" };
}

export function LiveStatusCard() {
  const { isAdmin } = useAuth();
  const semId = useSemesterStore((s) => s.activeSemester?.id);
  const activeClassroomId = useClassroomStore((s) => s.activeClassroom?.id);
  const {
    data: scheduleData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["todaySchedule", semId],
    queryFn: () => fetchTodaySchedule(semId),
    enabled: !!activeClassroomId,
    retry: 1,
  });
  const schedule = scheduleData ?? EMPTY_SCHEDULE;

  const [state, setState] = useState<LiveState>({ status: "free" });

  useEffect(() => {
    const visibleSchedule = isAdmin ? schedule : schedule.filter((slot) => !slot.draft);
    setState(computeState(visibleSchedule));
    const interval = setInterval(() => setState(computeState(visibleSchedule)), 10000);
    return () => clearInterval(interval);
  }, [scheduleData, isAdmin]);

  if (isLoading) {
    return (
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <CardTitle className="text-sm text-muted-foreground">CHECKING STATUS</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading today's classes...</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border border-destructive/30 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-destructive">STATUS UNAVAILABLE</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive/90">
            {error instanceof Error ? error.message : "Could not load live status."}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "live") {
    return (
      <Card className="border-2 border-primary bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-primary animate-pulse" />
            <CardTitle className="text-primary text-sm">LIVE NOW</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-lg font-bold">{state.classSlot.name}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {state.classSlot.code} · {state.classSlot.room} · {formatTime12(state.classSlot.startTime)} – {formatTime12(state.classSlot.endTime)}
            </p>
          </div>
          <div className="space-y-1">
            <Progress value={state.progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{state.remaining}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "upcoming") {
    return (
      <Card className="border-2 border-amber-500/50 bg-amber-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-amber-600 text-sm">UP NEXT</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold">{state.classSlot.name}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {state.classSlot.code} · {state.classSlot.room} · {formatTime12(state.classSlot.startTime)} – {formatTime12(state.classSlot.endTime)} · Starts in {state.startsIn}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-dashed border-muted-foreground/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Coffee className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-muted-foreground text-sm">FREE TIME</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">No classes in session. Take a break.</p>
      </CardContent>
    </Card>
  );
}
