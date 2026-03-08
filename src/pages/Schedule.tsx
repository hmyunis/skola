import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWeeklySchedule, type ClassSlot, type DayOfWeek } from "@/services/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const DAYS: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI"];
const START_HOUR = 8;
const END_HOUR = 17;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOUR_HEIGHT = 64; // px per hour

const typeColors: Record<string, { bg: string; border: string; text: string }> = {
  lecture: { bg: "bg-primary/10", border: "border-primary/40", text: "text-primary" },
  lab: { bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-700" },
  exam: { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive" },
};

function ClassBlock({ slot, showDraft }: { slot: ClassSlot; showDraft: boolean }) {
  const startMin = slot.startTime.getHours() * 60 + slot.startTime.getMinutes() - START_HOUR * 60;
  const endMin = slot.endTime.getHours() * 60 + slot.endTime.getMinutes() - START_HOUR * 60;
  const topPct = (startMin / TOTAL_MINUTES) * 100;
  const heightPct = ((endMin - startMin) / TOTAL_MINUTES) * 100;
  const colors = typeColors[slot.type] || typeColors.lecture;
  const isDraft = slot.draft && showDraft;

  const startStr = slot.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const endStr = slot.endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`absolute left-0.5 right-0.5 overflow-hidden border ${colors.bg} ${colors.border} ${
        isDraft ? "border-dashed border-2" : ""
      } p-1.5 transition-all hover:z-10 hover:shadow-md`}
      style={{ top: `${topPct}%`, height: `${heightPct}%`, minHeight: "28px" }}
    >
      <p className={`text-[10px] font-bold uppercase tracking-wider truncate ${colors.text}`}>
        {slot.name}
      </p>
      <p className="text-[9px] text-muted-foreground truncate">
        {slot.code} · {slot.room}
      </p>
      <p className="text-[9px] text-muted-foreground">
        {startStr}–{endStr}
      </p>
      {isDraft && (
        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Draft</span>
      )}
    </div>
  );
}

function WeeklyGrid({ schedule, showDraft }: { schedule: Record<string, ClassSlot[]>; showDraft: boolean }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="border border-border overflow-auto">
      {/* Header row */}
      <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-border sticky top-0 bg-card z-20">
        <div className="p-2 border-r border-border text-[10px] uppercase tracking-widest text-muted-foreground text-center">
          Time
        </div>
        {DAYS.map((day, i) => (
          <div key={day} className="p-2 border-r border-border last:border-r-0 text-center">
            <p className="text-xs font-bold uppercase tracking-wider">{DAY_SHORT[i]}</p>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(5,1fr)]">
        {/* Time labels column */}
        <div className="border-r border-border">
          {hours.map((h) => (
            <div
              key={h}
              className="border-b border-border flex items-start justify-center pt-1 text-[10px] text-muted-foreground tabular-nums"
              style={{ height: HOUR_HEIGHT }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((day) => (
          <div key={day} className="border-r border-border last:border-r-0 relative">
            {/* Hour grid lines */}
            {hours.map((h) => (
              <div key={h} className="border-b border-border" style={{ height: HOUR_HEIGHT }} />
            ))}
            {/* Class blocks */}
            <div className="absolute inset-0">
              {(schedule[day] || []).map((slot) => (
                <ClassBlock key={slot.id} slot={slot} showDraft={showDraft} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyAgenda({
  schedule,
  showDraft,
}: {
  schedule: Record<string, ClassSlot[]>;
  showDraft: boolean;
}) {
  const [dayIndex, setDayIndex] = useState(() => {
    const today = new Date().getDay();
    return Math.max(0, Math.min(4, today - 1));
  });

  const day = DAYS[dayIndex];
  const classes = (schedule[day] || []).filter((s) => showDraft || !s.draft);

  return (
    <div className="space-y-3">
      {/* Day picker */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setDayIndex(Math.max(0, dayIndex - 1))} disabled={dayIndex === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex justify-center gap-1">
          {DAYS.map((d, i) => (
            <button
              key={d}
              onClick={() => setDayIndex(i)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                i === dayIndex ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              {DAY_SHORT[i]}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setDayIndex(Math.min(4, dayIndex + 1))} disabled={dayIndex === 4}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Class list */}
      {classes.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 p-8 text-center">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">No classes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map((slot) => {
            const colors = typeColors[slot.type] || typeColors.lecture;
            const startStr = slot.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const endStr = slot.endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            return (
              <div
                key={slot.id}
                className={`border p-3 flex gap-3 ${colors.bg} ${colors.border} ${slot.draft ? "border-dashed border-2" : ""}`}
              >
                <div className="text-xs font-bold tabular-nums text-muted-foreground whitespace-nowrap pt-0.5">
                  {startStr}
                  <br />
                  {endStr}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold uppercase tracking-wide ${colors.text}`}>{slot.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {slot.code} · {slot.room} ·{" "}
                    <span className="uppercase text-[10px] tracking-wider">{slot.type}</span>
                  </p>
                  {slot.draft && (
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground border border-dashed border-muted-foreground/40 px-1.5 py-0.5">
                      Draft
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const Schedule = () => {
  const { isAdmin } = useTheme();
  const isMobile = useIsMobile();
  const [editMode, setEditMode] = useState(false);
  const [published, setPublished] = useState(false);

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["weeklySchedule"],
    queryFn: fetchWeeklySchedule,
  });

  const displaySchedule = useMemo(() => {
    if (!schedule) return {};
    if (published) {
      // After publish, remove draft flag visually
      const result: Record<string, ClassSlot[]> = {};
      for (const [day, slots] of Object.entries(schedule)) {
        result[day] = slots.map((s) => ({ ...s, draft: false }));
      }
      return result;
    }
    return schedule;
  }, [schedule, published]);

  const handlePublish = () => {
    setPublished(true);
    setEditMode(false);
    toast({ title: "Schedule Published", description: "All draft items are now live." });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Calendar</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Schedule</h1>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              <Pencil className="h-3 w-3" />
              {editMode ? "Editing" : "Edit Mode"}
            </Button>
            {editMode && (
              <Button size="sm" onClick={handlePublish}>
                <Check className="h-3 w-3" />
                Publish
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-widest">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-primary/20 border border-primary/40" />
          <span className="text-muted-foreground">Lecture</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-emerald-500/20 border border-emerald-500/40" />
          <span className="text-muted-foreground">Lab</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-destructive/20 border border-destructive/40" />
          <span className="text-muted-foreground">Exam</span>
        </div>
        {editMode && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border-2 border-dashed border-muted-foreground/40" />
            <span className="text-muted-foreground">Draft</span>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse" />
          ))}
        </div>
      ) : isMobile ? (
        <DailyAgenda schedule={displaySchedule} showDraft={editMode || !published} />
      ) : (
        <WeeklyGrid schedule={displaySchedule} showDraft={editMode || !published} />
      )}
    </div>
  );
};

export default Schedule;
