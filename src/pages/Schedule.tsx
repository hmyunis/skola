import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWeeklySchedule, COURSES, type ClassSlot, type DayOfWeek } from "@/services/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Check, ChevronLeft, ChevronRight, GripVertical, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { formatTime12, hourTo12, dateToTimeInput, timeInputToDate } from "@/lib/utils";

const DAYS: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI"];
const START_HOUR = 8;
const END_HOUR = 17;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOUR_HEIGHT = 64;

const typeColors: Record<string, { bg: string; border: string; text: string }> = {
  lecture: { bg: "bg-primary/10", border: "border-primary/40", text: "text-primary" },
  lab: { bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-700" },
  exam: { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive" },
};

// ─── Deep clone schedule preserving Date objects ───
function cloneSchedule(s: Record<string, ClassSlot[]>): Record<string, ClassSlot[]> {
  const r: Record<string, ClassSlot[]> = {};
  for (const [day, slots] of Object.entries(s)) {
    r[day] = slots.map((sl) => ({ ...sl, startTime: new Date(sl.startTime), endTime: new Date(sl.endTime) }));
  }
  return r;
}

// ─── Edit Dialog ───
interface EditDialogProps {
  slot: ClassSlot | null;
  day: DayOfWeek;
  onSave: (original: ClassSlot, updated: ClassSlot, originalDay: DayOfWeek, newDay: DayOfWeek) => void;
  onDelete: (slot: ClassSlot, day: DayOfWeek) => void;
  onClose: () => void;
}

function EditClassDialog({ slot, day, onSave, onDelete, onClose }: EditDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [type, setType] = useState<"lecture" | "lab" | "exam">("lecture");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(day);
  const [isDraft, setIsDraft] = useState(false);

  useEffect(() => {
    if (slot) {
      setCode(slot.code);
      setName(slot.name);
      setRoom(slot.room);
      setType(slot.type);
      setStartTime(dateToTimeInput(slot.startTime));
      setEndTime(dateToTimeInput(slot.endTime));
      setSelectedDay(day);
      setIsDraft(!!slot.draft);
    }
  }, [slot, day]);

  const handleCourseChange = (courseCode: string) => {
    setCode(courseCode);
    const course = COURSES.find((c) => c.code === courseCode);
    if (course) setName(course.name);
  };

  const handleSave = () => {
    if (!slot) return;
    const baseDate = slot.startTime;
    const updated: ClassSlot = {
      ...slot,
      code,
      name,
      room,
      type,
      startTime: timeInputToDate(baseDate, startTime),
      endTime: timeInputToDate(baseDate, endTime),
      draft: isDraft,
    };
    onSave(slot, updated, day, selectedDay);
  };

  return (
    <Dialog open={!!slot} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">Edit Class</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Course dropdown */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest">Course</Label>
            <Select value={code} onValueChange={handleCourseChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {COURSES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name override */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest">Session Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DSA Lab" />
          </div>

          {/* Room */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest">Room</Label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Lab 302" />
          </div>

          {/* Type + Day row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "lecture" | "lab" | "exam")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lecture">Lecture</SelectItem>
                  <SelectItem value="lab">Lab</SelectItem>
                  <SelectItem value="exam">Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest">Day</Label>
              <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Times row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest">Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest">End Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Draft */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDraft}
              onChange={(e) => setIsDraft(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-xs font-medium uppercase tracking-wide">Mark as Draft</span>
          </label>
        </div>

        <DialogFooter className="flex !justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => slot && onDelete(slot, day)}
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save Changes</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Class Block (Weekly Grid) ───
function ClassBlock({
  slot,
  showDraft,
  editMode,
  onClick,
}: {
  slot: ClassSlot;
  showDraft: boolean;
  editMode: boolean;
  onClick?: () => void;
}) {
  const startMin = slot.startTime.getHours() * 60 + slot.startTime.getMinutes() - START_HOUR * 60;
  const endMin = slot.endTime.getHours() * 60 + slot.endTime.getMinutes() - START_HOUR * 60;
  const topPct = (startMin / TOTAL_MINUTES) * 100;
  const heightPct = ((endMin - startMin) / TOTAL_MINUTES) * 100;
  const colors = typeColors[slot.type] || typeColors.lecture;
  const isDraft = slot.draft && showDraft;

  return (
    <div
      className={`absolute left-0.5 right-0.5 overflow-hidden border ${colors.bg} ${colors.border} ${
        isDraft ? "border-dashed border-2" : ""
      } p-1.5 transition-all hover:z-10 hover:shadow-md ${editMode ? "cursor-pointer" : ""}`}
      style={{ top: `${topPct}%`, height: `${heightPct}%`, minHeight: "28px" }}
      onClick={editMode ? onClick : undefined}
    >
      <p className={`text-[10px] font-bold uppercase tracking-wider truncate ${colors.text}`}>
        {slot.name}
      </p>
      <p className="text-[9px] text-muted-foreground truncate">
        {slot.code} · {slot.room}
      </p>
      <p className="text-[9px] text-muted-foreground">
        {formatTime12(slot.startTime)} – {formatTime12(slot.endTime)}
      </p>
      {isDraft && (
        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Draft</span>
      )}
    </div>
  );
}

// ─── Weekly Grid ───
function WeeklyGrid({
  schedule,
  showDraft,
  editMode,
  onClickSlot,
}: {
  schedule: Record<string, ClassSlot[]>;
  showDraft: boolean;
  editMode: boolean;
  onClickSlot: (slot: ClassSlot, day: DayOfWeek) => void;
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="border border-border overflow-auto">
      {/* Header */}
      <div className="grid grid-cols-[64px_repeat(5,1fr)] border-b border-border sticky top-0 bg-card z-20">
        <div className="p-2 border-r border-border text-[10px] uppercase tracking-widest text-muted-foreground text-center">
          Time
        </div>
        {DAYS.map((day, i) => (
          <div key={day} className="p-2 border-r border-border last:border-r-0 text-center">
            <p className="text-xs font-bold uppercase tracking-wider">{DAY_SHORT[i]}</p>
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="grid grid-cols-[64px_repeat(5,1fr)]">
        <div className="border-r border-border">
          {hours.map((h) => (
            <div
              key={h}
              className="border-b border-border flex items-start justify-center pt-1 text-[10px] text-muted-foreground tabular-nums"
              style={{ height: HOUR_HEIGHT }}
            >
              {hourTo12(h)}
            </div>
          ))}
        </div>
        {DAYS.map((day) => (
          <div key={day} className="border-r border-border last:border-r-0 relative">
            {hours.map((h) => (
              <div key={h} className="border-b border-border" style={{ height: HOUR_HEIGHT }} />
            ))}
            <div className="absolute inset-0">
              {(schedule[day] || []).map((slot) => (
                <ClassBlock
                  key={slot.id}
                  slot={slot}
                  showDraft={showDraft}
                  editMode={editMode}
                  onClick={() => onClickSlot(slot, day)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Daily Agenda (Mobile) with Drag-and-Drop ───
function DailyAgenda({
  schedule,
  showDraft,
  editMode,
  onClickSlot,
  onReorder,
}: {
  schedule: Record<string, ClassSlot[]>;
  showDraft: boolean;
  editMode: boolean;
  onClickSlot: (slot: ClassSlot, day: DayOfWeek) => void;
  onReorder: (day: DayOfWeek, fromIndex: number, toIndex: number) => void;
}) {
  const [dayIndex, setDayIndex] = useState(() => {
    const today = new Date().getDay();
    return Math.max(0, Math.min(4, today - 1));
  });
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSrcIdx = useRef<number | null>(null);

  const day = DAYS[dayIndex];
  const classes = (schedule[day] || []).filter((s) => showDraft || !s.draft);

  const handleDragStart = (idx: number) => {
    dragSrcIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragSrcIdx.current !== null && dragSrcIdx.current !== idx) {
      onReorder(day, dragSrcIdx.current, idx);
    }
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  };

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
          {classes.map((slot, idx) => {
            const colors = typeColors[slot.type] || typeColors.lecture;
            return (
              <div
                key={slot.id}
                draggable={editMode}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                onClick={editMode ? () => onClickSlot(slot, day) : undefined}
                className={`border p-3 flex gap-3 transition-all ${colors.bg} ${colors.border} ${
                  slot.draft ? "border-dashed border-2" : ""
                } ${editMode ? "cursor-pointer" : ""} ${dragOverIdx === idx ? "ring-2 ring-primary ring-offset-2" : ""}`}
              >
                {editMode && (
                  <div className="flex items-center text-muted-foreground cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
                <div className="text-xs font-bold tabular-nums text-muted-foreground whitespace-nowrap pt-0.5">
                  {formatTime12(slot.startTime)}
                  <br />
                  {formatTime12(slot.endTime)}
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

// ─── Main Schedule Page ───
const Schedule = () => {
  const { isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [editMode, setEditMode] = useState(false);
  const [localSchedule, setLocalSchedule] = useState<Record<string, ClassSlot[]>>({});
  const [editingSlot, setEditingSlot] = useState<{ slot: ClassSlot; day: DayOfWeek } | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<{ slot: ClassSlot; day: DayOfWeek } | null>(null);

  const { data: fetchedSchedule, isLoading } = useQuery({
    queryKey: ["weeklySchedule"],
    queryFn: fetchWeeklySchedule,
  });

  // Sync fetched data → local state when not editing
  useEffect(() => {
    if (fetchedSchedule && !editMode) {
      setLocalSchedule(cloneSchedule(fetchedSchedule));
    }
  }, [fetchedSchedule, editMode]);

  // Enter edit mode → snapshot current data
  const enterEditMode = () => {
    if (fetchedSchedule) {
      setLocalSchedule(cloneSchedule(fetchedSchedule));
    }
    setEditMode(true);
  };

  const handlePublish = () => {
    // In production, this would POST to API. For mock, just clear drafts.
    const published: Record<string, ClassSlot[]> = {};
    for (const [day, slots] of Object.entries(localSchedule)) {
      published[day] = slots.map((s) => ({ ...s, draft: false }));
    }
    setLocalSchedule(published);
    setEditMode(false);
    toast({ title: "Schedule Published", description: "All draft items are now live." });
  };

  // Save edit from dialog
  const handleSaveEdit = (original: ClassSlot, updated: ClassSlot, originalDay: DayOfWeek, newDay: DayOfWeek) => {
    setLocalSchedule((prev) => {
      const next = cloneSchedule(prev);
      // Remove from original day
      next[originalDay] = (next[originalDay] || []).filter((s) => s.id !== original.id);
      // Add to new day
      if (!next[newDay]) next[newDay] = [];
      next[newDay].push(updated);
      // Sort by start time
      next[newDay].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return next;
    });
    setEditingSlot(null);
  };

  // Drag-and-drop reorder — swap time slots
  const handleReorder = useCallback((day: DayOfWeek, fromIdx: number, toIdx: number) => {
    setLocalSchedule((prev) => {
      const next = cloneSchedule(prev);
      const slots = next[day];
      if (!slots || !slots[fromIdx] || !slots[toIdx]) return prev;

      // Swap times between the two slots
      const fromStart = new Date(slots[fromIdx].startTime);
      const fromEnd = new Date(slots[fromIdx].endTime);
      slots[fromIdx].startTime = new Date(slots[toIdx].startTime);
      slots[fromIdx].endTime = new Date(slots[toIdx].endTime);
      slots[toIdx].startTime = fromStart;
      slots[toIdx].endTime = fromEnd;

      // Mark both as draft
      slots[fromIdx].draft = true;
      slots[toIdx].draft = true;

      // Re-sort by start time
      next[day] = slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return next;
    });
  }, []);

  const onClickSlot = (slot: ClassSlot, day: DayOfWeek) => {
    if (editMode) setEditingSlot({ slot, day });
  };

  const handleDeleteSlot = (slot: ClassSlot, day: DayOfWeek) => {
    setEditingSlot(null);
    setDeletingSlot({ slot, day });
  };

  const confirmDelete = () => {
    if (!deletingSlot) return;
    setLocalSchedule((prev) => {
      const next = cloneSchedule(prev);
      next[deletingSlot.day] = (next[deletingSlot.day] || []).filter((s) => s.id !== deletingSlot.slot.id);
      return next;
    });
    toast({ title: "Class Removed", description: `${deletingSlot.slot.name} removed from ${deletingSlot.day}.` });
    setDeletingSlot(null);
  };

  const showDraft = editMode || Object.values(localSchedule).some((slots) => slots.some((s) => s.draft));

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
            {editMode ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                  <X className="h-3 w-3" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handlePublish}>
                  <Check className="h-3 w-3" />
                  Publish
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={enterEditMode}>
                <Pencil className="h-3 w-3" />
                Edit Mode
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
        {showDraft && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border-2 border-dashed border-muted-foreground/40" />
            <span className="text-muted-foreground">Draft</span>
          </div>
        )}
        {editMode && (
          <span className="text-muted-foreground/60 ml-2">Click a class to edit{isMobile ? " · Drag to swap" : ""}</span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-border p-3 flex items-center gap-3">
              <div className="h-10 w-1 bg-muted animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 bg-muted animate-pulse" />
                <div className="h-2.5 w-48 bg-muted animate-pulse" />
              </div>
              <div className="h-5 w-16 bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : isMobile ? (
        <DailyAgenda
          schedule={localSchedule}
          showDraft={showDraft}
          editMode={editMode}
          onClickSlot={onClickSlot}
          onReorder={handleReorder}
        />
      ) : (
        <WeeklyGrid
          schedule={localSchedule}
          showDraft={showDraft}
          editMode={editMode}
          onClickSlot={onClickSlot}
        />
      )}

      {/* Edit dialog */}
      {editingSlot && (
        <EditClassDialog
          slot={editingSlot.slot}
          day={editingSlot.day}
          onSave={handleSaveEdit}
          onDelete={handleDeleteSlot}
          onClose={() => setEditingSlot(null)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingSlot} onOpenChange={() => setDeletingSlot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-wider text-sm">Remove Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-bold">{deletingSlot?.slot.name}</span> ({deletingSlot?.slot.code}) from {deletingSlot?.day}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Schedule;
