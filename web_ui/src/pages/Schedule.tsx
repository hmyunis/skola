import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWeeklySchedule,
  createScheduleItem,
  updateScheduleItem,
  deleteScheduleItem,
  confirmScheduleItem,
  unconfirmScheduleItem,
  type ClassSlot,
  type DayOfWeek,
} from "@/services/api";
import { CourseSelectDropdown } from "@/components/CourseSelectDropdown";
import { useAuth } from "@/stores/authStore";
import { useSemesterStore } from "@/stores/semesterStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Pencil, ChevronLeft, ChevronRight, GripVertical, Trash2, Plus, Loader2, ArrowLeft } from "lucide-react";
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
import { formatTime12, hourTo12, dateToTimeInput } from "@/lib/utils";
import { format, formatDistanceToNowStrict } from "date-fns";
import { createAnnouncement } from "@/services/announcements";

const DAYS: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_TO_INDEX: Record<DayOfWeek, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};
const START_HOUR = 8;
const END_HOUR = 17;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOUR_HEIGHT = 64;
const RECENT_CONFIRM_WINDOW_MS = 72 * 60 * 60 * 1000;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function toTimeInput(minutesFromMidnight: number): string {
  const normalized = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseTimeToMinutes(value: Date): number {
  return value.getHours() * 60 + value.getMinutes();
}

function getTempTimeWindow(daySlots: ClassSlot[], excludeIds: string[]): { startTime: string; endTime: string } {
  const occupied = daySlots
    .filter((slot) => !excludeIds.includes(slot.id))
    .map((slot) => ({ start: parseTimeToMinutes(slot.startTime), end: parseTimeToMinutes(slot.endTime) }))
    .sort((a, b) => a.start - b.start);

  let cursor = 0;
  for (const interval of occupied) {
    if (cursor + 1 <= interval.start) {
      return { startTime: toTimeInput(cursor), endTime: toTimeInput(cursor + 1) };
    }
    cursor = Math.max(cursor, interval.end);
  }

  if (cursor <= 1438) {
    return { startTime: toTimeInput(cursor), endTime: toTimeInput(cursor + 1) };
  }

  throw new Error("Could not find temporary time window for reordering");
}

type FireMode = "auto" | "on" | "off";
type FireVisibility =
  | { show: false; reason: "off" | "none" }
  | { show: true; reason: "manual" }
  | { show: true; reason: "recent"; confirmedAt: Date };

function getFireMode(slot: ClassSlot): FireMode {
  return slot.fireMode || "auto";
}

function hasConfirmedTimestamp(slot: ClassSlot): slot is ClassSlot & { confirmedAt: Date } {
  return !!slot.confirmedAt && !Number.isNaN(slot.confirmedAt.getTime());
}

function isRecentlyConfirmed(slot: ClassSlot): slot is ClassSlot & { confirmedAt: Date } {
  if (slot.draft || !hasConfirmedTimestamp(slot)) return false;
  return Date.now() - slot.confirmedAt.getTime() <= RECENT_CONFIRM_WINDOW_MS;
}

function getFireVisibility(slot: ClassSlot): FireVisibility {
  if (slot.draft) return { show: false, reason: "none" };
  const fireMode = getFireMode(slot);
  if (fireMode === "off") return { show: false, reason: "off" };
  if (fireMode === "on") return { show: true, reason: "manual" };
  if (isRecentlyConfirmed(slot)) return { show: true, reason: "recent", confirmedAt: slot.confirmedAt };
  return { show: false, reason: "none" };
}

function formatConfirmedAtRelative(confirmedAt: Date): string {
  return formatDistanceToNowStrict(confirmedAt, { addSuffix: true });
}

function formatConfirmedAtExact(confirmedAt: Date): string {
  return format(confirmedAt, "PPP p");
}

const typeColors: Record<string, { bg: string; border: string; text: string }> = {
  lecture: { bg: "bg-primary/10", border: "border-primary/40", text: "text-primary" },
  lab: { bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-700" },
  exam: { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive" },
  other: { bg: "bg-muted", border: "border-border", text: "text-foreground" },
};

// ─── Deep clone schedule preserving Date objects ───
function cloneSchedule(s: Record<string, ClassSlot[]>): Record<string, ClassSlot[]> {
  const r: Record<string, ClassSlot[]> = {};
  for (const [day, slots] of Object.entries(s)) {
    r[day] = slots.map((sl) => ({
      ...sl,
      startTime: new Date(sl.startTime),
      endTime: new Date(sl.endTime),
      confirmedAt: sl.confirmedAt ? new Date(sl.confirmedAt) : null,
      fireMode: sl.fireMode || "auto",
    }));
  }
  return r;
}

function buildScheduleSummaryMessage(schedule: Record<string, ClassSlot[]>) {
  const now = new Date();
  const day = now.getDay(); // 0..6
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const rangeLabel = `${format(monday, "MMM d")} - ${format(sunday, "MMM d, yyyy")}`;
  const title = `Weekly Schedule Summary (${rangeLabel})`;
  const lines: string[] = [`Week: ${rangeLabel}`, "", "Legend: 🔥 = recently confirmed or manually highlighted", ""];

  DAYS.forEach((dayName, idx) => {
    const slots = (schedule[dayName] || [])
      .filter((slot) => !slot.draft)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    lines.push(`${DAY_SHORT[idx]} (${dayName})`);
    if (!slots.length) {
      lines.push("- No classes");
      lines.push("");
      return;
    }

    for (const slot of slots) {
      const fire = getFireVisibility(slot).show ? " 🔥" : "";
      lines.push(
        `- ${formatTime12(slot.startTime)}-${formatTime12(slot.endTime)} | ${slot.code} ${slot.name} | ${slot.room || "TBA"}${fire}`,
      );
    }
    lines.push("");
  });

  let content = lines.join("\n").trim();
  const MAX_CONTENT_LENGTH = 3300;
  if (content.length > MAX_CONTENT_LENGTH) {
    content = `${content.slice(0, MAX_CONTENT_LENGTH).trim()}\n\n...trimmed for notification length.`;
  }

  return { title, content };
}

function ConfirmedFireBadge({ slot }: { slot: ClassSlot }) {
  const fire = getFireVisibility(slot);
  if (!fire.show) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-5 w-5 shrink-0 rounded-full border border-orange-500/40 bg-orange-500/10 text-[11px] leading-none hover:bg-orange-500/20 transition-colors"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="View confirmation details"
        >
          🔥
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2.5" align="end" side="top">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Hot Class</p>
        {fire.reason === "manual" ? (
          <p className="text-xs font-semibold mt-1">Manually highlighted by admin/owner</p>
        ) : (
          <>
            <p className="text-xs font-semibold mt-1">Confirmed {formatConfirmedAtRelative(fire.confirmedAt)}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{formatConfirmedAtExact(fire.confirmedAt)}</p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Schedule Dialog ───
interface ScheduleFormValues {
  courseId: string;
  code: string;
  name: string;
  room: string;
  type: "lecture" | "lab" | "exam" | "other";
  startTime: string;
  endTime: string;
  selectedDay: DayOfWeek;
  isDraft: boolean;
}

interface ScheduleDialogProps {
  open: boolean;
  mode: "create" | "edit";
  slot: ClassSlot | null;
  day: DayOfWeek;
  semesterId?: string;
  isSubmitting?: boolean;
  isDeleting?: boolean;
  canConfirm?: boolean;
  isTogglingConfirmation?: boolean;
  isTogglingFire?: boolean;
  onSave: (values: ScheduleFormValues) => void;
  onDelete: (slot: ClassSlot, day: DayOfWeek) => void;
  onConfirmSlot?: (slot: ClassSlot) => void;
  onRequestUnconfirmSlot?: (slot: ClassSlot) => void;
  onSetFireMode?: (slot: ClassSlot, fireMode: FireMode) => void;
  onClose: () => void;
}

function ClassDetailDialog({
  open,
  slot,
  day,
  canConfirm = false,
  isTogglingConfirmation = false,
  isTogglingFire = false,
  onConfirmSlot,
  onRequestUnconfirmSlot,
  onSetFireMode,
  onClose,
}: {
  open: boolean;
  slot: ClassSlot | null;
  day: DayOfWeek | null;
  canConfirm?: boolean;
  isTogglingConfirmation?: boolean;
  isTogglingFire?: boolean;
  onConfirmSlot?: (slot: ClassSlot) => void;
  onRequestUnconfirmSlot?: (slot: ClassSlot) => void;
  onSetFireMode?: (slot: ClassSlot, fireMode: FireMode) => void;
  onClose: () => void;
}) {
  if (!slot || !day) return null;

  const typeLabel = slot.type.charAt(0).toUpperCase() + slot.type.slice(1);
  const fireMode = getFireMode(slot);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">Class Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Course</p>
            <p className="text-base font-bold break-words">{slot.name}</p>
            <p className="text-xs text-muted-foreground">{slot.code}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Day</p>
              <p className="text-sm font-medium">{day}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Time</p>
              <p className="text-sm font-medium">
                {formatTime12(slot.startTime)} - {formatTime12(slot.endTime)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Type</p>
              <p className="text-sm font-medium">{typeLabel}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Room</p>
              <p className="text-sm font-medium break-words">{slot.room || "TBA"}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</p>
            <p className="text-sm font-medium">{slot.draft ? "Draft" : "Published"}</p>
            {!slot.draft && hasConfirmedTimestamp(slot) ? (
              <p className="text-xs text-muted-foreground mt-1">
                Confirmed {formatConfirmedAtRelative(slot.confirmedAt)} ({formatConfirmedAtExact(slot.confirmedAt)})
              </p>
            ) : null}
          </div>

          {canConfirm && (
            <div className="space-y-2">
              <div className="border border-border p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Confirmation</p>
                {slot.draft ? (
                  <p className="text-xs text-muted-foreground">Publish this class first before confirming it.</p>
                ) : hasConfirmedTimestamp(slot) ? (
                  <p className="text-xs text-muted-foreground">This class is currently confirmed.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Mark this class as confirmed for students.</p>
                )}
                <div className="flex gap-2">
                  {!hasConfirmedTimestamp(slot) ? (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={slot.draft || isTogglingConfirmation}
                      onClick={() => onConfirmSlot?.(slot)}
                    >
                      {isTogglingConfirmation ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Confirm
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={isTogglingConfirmation}
                      onClick={() => onRequestUnconfirmSlot?.(slot)}
                    >
                      {isTogglingConfirmation ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Unconfirm
                    </Button>
                  )}
                </div>
              </div>
              <div className="border border-border p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Fire Badge</p>
                <p className="text-xs text-muted-foreground">
                  Current mode: <span className="font-semibold uppercase">{fireMode}</span>
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    size="sm"
                    variant={fireMode === "on" ? "default" : "outline"}
                    disabled={isTogglingFire || slot.draft}
                    onClick={() => onSetFireMode?.(slot, "on")}
                  >
                    Show Fire
                  </Button>
                  <Button
                    size="sm"
                    variant={fireMode === "off" ? "default" : "outline"}
                    disabled={isTogglingFire || slot.draft}
                    onClick={() => onSetFireMode?.(slot, "off")}
                  >
                    Remove Fire
                  </Button>
                  <Button
                    size="sm"
                    variant={fireMode === "auto" ? "default" : "outline"}
                    disabled={isTogglingFire || slot.draft}
                    onClick={() => onSetFireMode?.(slot, "auto")}
                  >
                    Auto
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleItemDialog({
  open,
  mode,
  slot,
  day,
  semesterId,
  isSubmitting = false,
  isDeleting = false,
  canConfirm = false,
  isTogglingConfirmation = false,
  isTogglingFire = false,
  onSave,
  onDelete,
  onConfirmSlot,
  onRequestUnconfirmSlot,
  onSetFireMode,
  onClose,
}: ScheduleDialogProps) {
  const [courseId, setCourseId] = useState("");
  const [courseLabel, setCourseLabel] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [type, setType] = useState<"lecture" | "lab" | "exam" | "other">("lecture");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(day);
  const [isDraft, setIsDraft] = useState(mode === "create");

  useEffect(() => {
    if (!open) return;
    if (slot) {
      setCourseId(slot.courseId || "");
      setCourseLabel([slot.code, slot.name].filter(Boolean).join(" — "));
      setCode(slot.code);
      setName(slot.name);
      setRoom(slot.room);
      setType(slot.type);
      setStartTime(dateToTimeInput(slot.startTime));
      setEndTime(dateToTimeInput(slot.endTime));
      setSelectedDay(day);
      setIsDraft(!!slot.draft);
      return;
    }

    setCourseId("");
    setCourseLabel("");
    setCode("");
    setName("");
    setRoom("");
    setType("lecture");
    setStartTime("09:00");
    setEndTime("10:00");
    setSelectedDay(day);
    setIsDraft(true);
  }, [open, slot, day]);

  const handleSave = () => {
    if (!courseId) {
      toast({ title: "Course required", description: "Select a course before saving.", variant: "destructive" });
      return;
    }
    if (startTime >= endTime) {
      toast({ title: "Invalid time", description: "End time must be after start time.", variant: "destructive" });
      return;
    }

    onSave({
      courseId,
      code,
      name,
      room,
      type,
      startTime,
      endTime,
      selectedDay,
      isDraft,
    });
  };

  const title = mode === "create" ? "Add Class" : "Edit Class";
  const fireMode = slot ? getFireMode(slot) : "auto";

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 sm:space-y-4 py-2 sm:py-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest">Course</Label>
            <CourseSelectDropdown
              value={courseId || undefined}
              onChange={(value, course) => {
                const nextId = value === "none" ? "" : value;
                setCourseId(nextId);
                if (!course) {
                  if (!nextId) {
                    setCourseLabel("");
                    setCode("");
                    setName("");
                  }
                  return;
                }
                const nextCode = course.code || "";
                setCode(nextCode);
                setName(course.name || "");
                setCourseLabel(nextCode ? `${nextCode} — ${course.name}` : course.name);
              }}
              placeholder="Select course"
              className="w-full h-10 text-sm"
              semesterId={semesterId}
              returnValue="id"
              selectedLabel={courseLabel || undefined}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest">Session Name</Label>
            <Input value={name} readOnly placeholder="Auto from selected course" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-widest">Room</Label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Lab 302" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "lecture" | "lab" | "exam" | "other")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lecture">Lecture</SelectItem>
                  <SelectItem value="lab">Lab</SelectItem>
                  <SelectItem value="exam">Exam</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest">Start Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest">End Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDraft}
              onChange={(e) => setIsDraft(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-xs font-medium uppercase tracking-wide">Mark as Draft</span>
          </label>

          {mode === "edit" && slot && canConfirm && (
            <div className="space-y-2">
              <div className="border border-border p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Confirmation</p>
                {slot.draft ? (
                  <p className="text-xs text-muted-foreground">Publish this class first before confirming it.</p>
                ) : hasConfirmedTimestamp(slot) ? (
                  <p className="text-xs text-muted-foreground">
                    Confirmed {formatConfirmedAtRelative(slot.confirmedAt)} ({formatConfirmedAtExact(slot.confirmedAt)})
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">This class is not yet confirmed.</p>
                )}
                {!hasConfirmedTimestamp(slot) ? (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={slot.draft || isTogglingConfirmation || isSubmitting || isDeleting}
                    onClick={() => onConfirmSlot?.(slot)}
                  >
                    {isTogglingConfirmation ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Confirm
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isTogglingConfirmation || isSubmitting || isDeleting}
                    onClick={() => onRequestUnconfirmSlot?.(slot)}
                  >
                    {isTogglingConfirmation ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Unconfirm
                  </Button>
                )}
              </div>
              <div className="border border-border p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Fire Badge</p>
                <p className="text-xs text-muted-foreground">
                  Current mode: <span className="font-semibold uppercase">{fireMode}</span>
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    size="sm"
                    variant={fireMode === "on" ? "default" : "outline"}
                    disabled={slot.draft || isTogglingFire || isSubmitting || isDeleting}
                    onClick={() => onSetFireMode?.(slot, "on")}
                  >
                    Show Fire
                  </Button>
                  <Button
                    size="sm"
                    variant={fireMode === "off" ? "default" : "outline"}
                    disabled={slot.draft || isTogglingFire || isSubmitting || isDeleting}
                    onClick={() => onSetFireMode?.(slot, "off")}
                  >
                    Remove Fire
                  </Button>
                  <Button
                    size="sm"
                    variant={fireMode === "auto" ? "default" : "outline"}
                    disabled={slot.draft || isTogglingFire || isSubmitting || isDeleting}
                    onClick={() => onSetFireMode?.(slot, "auto")}
                  >
                    Auto
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {mode === "edit" ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => slot && onDelete(slot, day)}
              disabled={isDeleting || isSubmitting}
              className="w-full sm:w-auto"
            >
              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Remove
            </Button>
          ) : (
            <div />
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onClose} disabled={isSubmitting || isDeleting}>Cancel</Button>
            <Button size="sm" className="w-full sm:w-auto" onClick={handleSave} disabled={isSubmitting || isDeleting}>
              {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {mode === "create" ? "Add Class" : "Save Changes"}
            </Button>
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
  clickable,
  onClick,
}: {
  slot: ClassSlot;
  showDraft: boolean;
  clickable: boolean;
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
      } p-1.5 transition-all hover:z-10 hover:shadow-md ${clickable ? "cursor-pointer" : ""}`}
      style={{ top: `${topPct}%`, height: `${heightPct}%`, minHeight: "28px" }}
      onClick={onClick}
    >
      <div className="flex items-start gap-1.5">
        <p className={`min-w-0 flex-1 text-[10px] font-bold uppercase tracking-wider truncate ${colors.text}`}>
          {slot.name}
        </p>
        <ConfirmedFireBadge slot={slot} />
      </div>
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
      <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border sticky top-0 bg-card z-20">
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
      <div className="grid grid-cols-[64px_repeat(7,1fr)]">
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
                  clickable={!!onClickSlot}
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
    return (today + 6) % 7;
  });
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSrcIdx = useRef<number | null>(null);
  const dayStripRef = useRef<HTMLDivElement | null>(null);

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

  const scrollDayStrip = (direction: "left" | "right") => {
    if (!dayStripRef.current) return;
    const amount = 120;
    dayStripRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="space-y-3">
      {/* Day picker */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setDayIndex(Math.max(0, dayIndex - 1));
            scrollDayStrip("left");
          }}
          disabled={dayIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div ref={dayStripRef} className="max-w-full overflow-x-auto">
            <div className="flex min-w-max gap-1">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setDayIndex(i)}
                  className={`shrink-0 min-w-[56px] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                    i === dayIndex ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {DAY_SHORT[i]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setDayIndex(Math.min(DAYS.length - 1, dayIndex + 1));
            scrollDayStrip("right");
          }}
          disabled={dayIndex === DAYS.length - 1}
        >
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
                onClick={() => onClickSlot(slot, day)}
                className={`border p-3 flex gap-3 transition-all ${colors.bg} ${colors.border} ${
                  slot.draft ? "border-dashed border-2" : ""
                } ${onClickSlot ? "cursor-pointer" : ""} ${dragOverIdx === idx ? "ring-2 ring-primary ring-offset-2" : ""}`}
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
                  <div className="flex items-start gap-2">
                    <p className={`min-w-0 flex-1 text-sm font-bold uppercase tracking-wide ${colors.text}`}>{slot.name}</p>
                    <ConfirmedFireBadge slot={slot} />
                  </div>
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
  const semId = useSemesterStore((s) => s.activeSemester?.id);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [localSchedule, setLocalSchedule] = useState<Record<string, ClassSlot[]>>({});
  const [editingSlot, setEditingSlot] = useState<{ slot: ClassSlot; day: DayOfWeek } | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<{ slot: ClassSlot; day: DayOfWeek } | null>(null);
  const [viewingSlot, setViewingSlot] = useState<{ slot: ClassSlot; day: DayOfWeek } | null>(null);
  const [unconfirmingSlot, setUnconfirmingSlot] = useState<ClassSlot | null>(null);
  const [notifyPreviewOpen, setNotifyPreviewOpen] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyContent, setNotifyContent] = useState("");
  const [sendScheduleToTelegram, setSendScheduleToTelegram] = useState(true);

  const { data: fetchedSchedule, isLoading, isError, refetch } = useQuery({
    queryKey: ["weeklySchedule", semId],
    queryFn: () => fetchWeeklySchedule(semId),
  });

  const refreshScheduleQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["weeklySchedule"] }),
      queryClient.invalidateQueries({ queryKey: ["todaySchedule"] }),
      queryClient.invalidateQueries({ queryKey: ["quickStats"] }),
    ]);
  }, [queryClient]);

  const applyFireModeLocally = useCallback((id: string, fireMode: FireMode) => {
    setLocalSchedule((prev) => {
      const next: Record<string, ClassSlot[]> = {};
      for (const [day, slots] of Object.entries(prev)) {
        next[day] = slots.map((slot) => (slot.id === id ? { ...slot, fireMode } : slot));
      }
      return next;
    });
    setViewingSlot((prev) =>
      prev && prev.slot.id === id
        ? { ...prev, slot: { ...prev.slot, fireMode } }
        : prev,
    );
    setEditingSlot((prev) =>
      prev && prev.slot.id === id
        ? { ...prev, slot: { ...prev.slot, fireMode } }
        : prev,
    );
  }, []);

  const createMutation = useMutation({
    mutationFn: createScheduleItem,
    onSuccess: async () => {
      await refreshScheduleQueries();
      setCreateOpen(false);
      toast({ title: "Class Added", description: "New schedule item added successfully." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Create failed",
        description: getErrorMessage(error, "Could not add class."),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateScheduleItem>[1] }) =>
      updateScheduleItem(id, payload),
    onSuccess: async () => {
      await refreshScheduleQueries();
      setEditingSlot(null);
      toast({ title: "Class Updated", description: "Schedule item saved successfully." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Update failed",
        description: getErrorMessage(error, "Could not save class changes."),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteScheduleItem(id),
    onSuccess: async () => {
      await refreshScheduleQueries();
      if (deletingSlot) {
        toast({ title: "Class Removed", description: `${deletingSlot.slot.name} removed from ${deletingSlot.day}.` });
      }
      setDeletingSlot(null);
      setEditingSlot(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Delete failed",
        description: getErrorMessage(error, "Could not remove class."),
        variant: "destructive",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmScheduleItem(id),
    onSuccess: async () => {
      await refreshScheduleQueries();
      setEditingSlot(null);
      setViewingSlot(null);
      toast({ title: "Class Confirmed", description: "Class marked as confirmed." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Confirm failed",
        description: getErrorMessage(error, "Could not confirm this class."),
        variant: "destructive",
      });
    },
  });

  const unconfirmMutation = useMutation({
    mutationFn: (id: string) => unconfirmScheduleItem(id),
    onSuccess: async () => {
      await refreshScheduleQueries();
      setUnconfirmingSlot(null);
      setEditingSlot(null);
      setViewingSlot(null);
      toast({ title: "Confirmation Removed", description: "Class is no longer confirmed." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Unconfirm failed",
        description: getErrorMessage(error, "Could not remove confirmation."),
        variant: "destructive",
      });
    },
  });

  const fireModeMutation = useMutation({
    mutationFn: ({ id, fireMode }: { id: string; fireMode: FireMode }) =>
      updateScheduleItem(id, { fireMode }),
    onSuccess: (_data, variables) => {
      applyFireModeLocally(variables.id, variables.fireMode);
      void refreshScheduleQueries();
      toast({ title: "Fire Updated", description: "Fire visibility updated for this class." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Fire update failed",
        description: getErrorMessage(error, "Could not update fire visibility."),
        variant: "destructive",
      });
    },
  });

  const notifySummaryMutation = useMutation({
    mutationFn: ({
      title,
      content,
      sendTelegram,
    }: {
      title: string;
      content: string;
      sendTelegram: boolean;
    }) =>
      createAnnouncement({
        title,
        content,
        priority: "normal",
        targetAudience: "all",
        pinned: false,
        sendTelegram,
      }),
    onSuccess: () => {
      setNotifyPreviewOpen(false);
      toast({ title: "Weekly Summary Sent", description: "Notification delivered to enabled channels." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Send failed",
        description: getErrorMessage(error, "Could not send weekly schedule summary."),
        variant: "destructive",
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ day, fromIdx, toIdx }: { day: DayOfWeek; fromIdx: number; toIdx: number }) => {
      const daySlots = localSchedule[day] || [];
      const source = daySlots[fromIdx];
      const target = daySlots[toIdx];
      if (!source || !target) return;

      const sourceStart = dateToTimeInput(source.startTime);
      const sourceEnd = dateToTimeInput(source.endTime);
      const targetStart = dateToTimeInput(target.startTime);
      const targetEnd = dateToTimeInput(target.endTime);
      const tempWindow = getTempTimeWindow(daySlots, [source.id, target.id]);

      await updateScheduleItem(source.id, {
        startTime: tempWindow.startTime,
        endTime: tempWindow.endTime,
        isDraft: true,
      });

      await updateScheduleItem(target.id, {
        startTime: sourceStart,
        endTime: sourceEnd,
        isDraft: true,
      });

      await updateScheduleItem(source.id, {
        startTime: targetStart,
        endTime: targetEnd,
        isDraft: true,
      });
    },
    onSuccess: async () => {
      await refreshScheduleQueries();
      toast({ title: "Order Updated", description: "Class times swapped and marked as draft." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Reorder failed",
        description: getErrorMessage(error, "Could not reorder classes."),
        variant: "destructive",
      });
    },
  });

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    confirmMutation.isPending ||
    unconfirmMutation.isPending ||
    fireModeMutation.isPending ||
    reorderMutation.isPending;

  // Sync fetched data → local state
  useEffect(() => {
    if (fetchedSchedule) {
      setLocalSchedule(cloneSchedule(fetchedSchedule));
    }
  }, [fetchedSchedule]);

  const enterEditMode = () => {
    setViewingSlot(null);
    setEditMode(true);
  };

  const cancelEditMode = () => {
    setEditMode(false);
    setCreateOpen(false);
    setEditingSlot(null);
    if (fetchedSchedule) setLocalSchedule(cloneSchedule(fetchedSchedule));
  };

  const handleCreateItem = (values: ScheduleFormValues) => {
    createMutation.mutate({
      courseId: values.courseId,
      dayOfWeek: DAY_TO_INDEX[values.selectedDay],
      startTime: values.startTime,
      endTime: values.endTime,
      type: values.type,
      location: values.room.trim() || undefined,
      isDraft: values.isDraft,
    });
  };

  const handleSaveEdit = (values: ScheduleFormValues) => {
    if (!editingSlot) return;
    updateMutation.mutate({
      id: editingSlot.slot.id,
      payload: {
        courseId: values.courseId,
        dayOfWeek: DAY_TO_INDEX[values.selectedDay],
        startTime: values.startTime,
        endTime: values.endTime,
        type: values.type,
        location: values.room.trim() || undefined,
        isDraft: values.isDraft,
      },
    });
  };

  const handleReorder = useCallback((day: DayOfWeek, fromIdx: number, toIdx: number) => {
    if (!editMode || !isAdmin || isMutating) return;
    reorderMutation.mutate({ day, fromIdx, toIdx });
  }, [editMode, isAdmin, isMutating, reorderMutation]);

  const onClickSlot = (slot: ClassSlot, day: DayOfWeek) => {
    if (editMode && isAdmin) {
      setEditingSlot({ slot, day });
      return;
    }
    setViewingSlot({ slot, day });
  };

  const handleDeleteSlot = (slot: ClassSlot, day: DayOfWeek) => {
    setEditingSlot(null);
    setDeletingSlot({ slot, day });
  };

  const confirmDelete = () => {
    if (!deletingSlot) return;
    deleteMutation.mutate(deletingSlot.slot.id);
  };

  const handleConfirmSlot = (slot: ClassSlot) => {
    confirmMutation.mutate(slot.id);
  };

  const handleRequestUnconfirmSlot = (slot: ClassSlot) => {
    setUnconfirmingSlot(slot);
  };

  const confirmUnconfirm = () => {
    if (!unconfirmingSlot) return;
    unconfirmMutation.mutate(unconfirmingSlot.id);
  };

  const handleSetFireMode = (slot: ClassSlot, fireMode: FireMode) => {
    fireModeMutation.mutate({ id: slot.id, fireMode });
  };

  const showDraft = isAdmin && editMode;
  const scheduleForView = useMemo(() => {
    if (showDraft) return localSchedule;
    const filtered: Record<string, ClassSlot[]> = {};
    for (const [day, slots] of Object.entries(localSchedule)) {
      filtered[day] = slots.filter((slot) => !slot.draft);
    }
    return filtered;
  }, [showDraft, localSchedule]);

  const publishedSchedule = useMemo(() => {
    const result: Record<string, ClassSlot[]> = {};
    for (const [day, slots] of Object.entries(localSchedule)) {
      result[day] = slots.filter((slot) => !slot.draft);
    }
    return result;
  }, [localSchedule]);

  const weeklySummary = useMemo(
    () => buildScheduleSummaryMessage(publishedSchedule),
    [publishedSchedule],
  );

  const handleOpenNotifyPreview = () => {
    setNotifyTitle(weeklySummary.title);
    setNotifyContent(weeklySummary.content);
    setNotifyPreviewOpen(true);
  };

  const sendWeeklySummary = () => {
    const title = notifyTitle.trim();
    const content = notifyContent.trim();
    if (!title || !content) {
      toast({
        title: "Missing content",
        description: "Title and message are required before sending.",
        variant: "destructive",
      });
      return;
    }
    notifySummaryMutation.mutate({
      title,
      content,
      sendTelegram: sendScheduleToTelegram,
    });
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
          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="max-w-full"
              onClick={handleOpenNotifyPreview}
              disabled={notifySummaryMutation.isPending}
            >
              {notifySummaryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Notify Weekly Summary
            </Button>
            {editMode ? (
              <>
                <Button variant="outline" size="sm" className="max-w-full" onClick={() => setCreateOpen(true)} disabled={isMutating}>
                  <Plus className="h-3 w-3" />
                  Add Class
                </Button>
                <Button variant="outline" size="sm" className="max-w-full" onClick={cancelEditMode} disabled={isMutating}>
                  <ArrowLeft className="h-3 w-3" />
                  Back to View Mode
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="max-w-full" onClick={enterEditMode} disabled={isMutating}>
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
        <div className="flex items-center gap-1.5">
          <span>🔥</span>
          <span className="text-muted-foreground">Hot (recent/manual)</span>
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
      ) : isError ? (
        <div className="border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Could not load schedule</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : isMobile ? (
        <DailyAgenda
          schedule={scheduleForView}
          showDraft={showDraft}
          editMode={editMode && isAdmin}
          onClickSlot={onClickSlot}
          onReorder={handleReorder}
        />
      ) : (
        <WeeklyGrid
          schedule={scheduleForView}
          showDraft={showDraft}
          editMode={editMode && isAdmin}
          onClickSlot={onClickSlot}
        />
      )}

      <ClassDetailDialog
        open={!!viewingSlot}
        slot={viewingSlot?.slot || null}
        day={viewingSlot?.day || null}
        canConfirm={isAdmin}
        isTogglingConfirmation={confirmMutation.isPending || unconfirmMutation.isPending}
        isTogglingFire={fireModeMutation.isPending}
        onConfirmSlot={handleConfirmSlot}
        onRequestUnconfirmSlot={handleRequestUnconfirmSlot}
        onSetFireMode={handleSetFireMode}
        onClose={() => setViewingSlot(null)}
      />

      <ScheduleItemDialog
        open={createOpen}
        mode="create"
        slot={null}
        day="Monday"
        semesterId={semId}
        isSubmitting={createMutation.isPending}
        onSave={handleCreateItem}
        onDelete={handleDeleteSlot}
        onClose={() => setCreateOpen(false)}
      />

      <ScheduleItemDialog
        open={!!editingSlot}
        mode="edit"
        slot={editingSlot?.slot || null}
        day={editingSlot?.day || "Monday"}
        semesterId={semId}
        isSubmitting={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        canConfirm={isAdmin}
        isTogglingConfirmation={confirmMutation.isPending || unconfirmMutation.isPending}
        isTogglingFire={fireModeMutation.isPending}
        onSave={handleSaveEdit}
        onDelete={handleDeleteSlot}
        onConfirmSlot={handleConfirmSlot}
        onRequestUnconfirmSlot={handleRequestUnconfirmSlot}
        onSetFireMode={handleSetFireMode}
        onClose={() => setEditingSlot(null)}
      />

      <Dialog open={notifyPreviewOpen} onOpenChange={setNotifyPreviewOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider text-sm">Weekly Summary Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="border border-border p-3">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Title</Label>
              <Input
                className="mt-2"
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
                placeholder="Weekly Schedule Summary"
              />
            </div>
            <div className="border border-border p-3">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Message</Label>
              <Textarea
                className="mt-2 min-h-[260px] font-mono text-[11px] leading-relaxed"
                value={notifyContent}
                onChange={(e) => setNotifyContent(e.target.value)}
                placeholder="Write notification message..."
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendScheduleToTelegram}
                onChange={(e) => setSendScheduleToTelegram(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-xs text-muted-foreground">
                Also send to classroom Telegram group by bot (if configured)
              </span>
            </label>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" onClick={() => setNotifyPreviewOpen(false)} disabled={notifySummaryMutation.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={sendWeeklySummary}
              disabled={notifySummaryMutation.isPending || !notifyTitle.trim() || !notifyContent.trim()}
            >
              {notifySummaryMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unconfirm confirmation */}
      <AlertDialog open={!!unconfirmingSlot} onOpenChange={() => setUnconfirmingSlot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase tracking-wider text-sm">Remove Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove confirmation from{" "}
              <span className="font-bold">{unconfirmingSlot?.name}</span> ({unconfirmingSlot?.code})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unconfirmMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnconfirm} disabled={unconfirmMutation.isPending}>
              {unconfirmMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Remove Confirmation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Schedule;
