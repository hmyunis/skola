import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearAssignmentConfidence,
  fetchAssessmentStats,
  fetchAssignments,
  rateAssignmentConfidence,
  type Assignment,
} from "@/services/api";
import {
  createAssessment,
  deleteAssessment,
  loadAssessments,
  updateAssessment,
  type Assessment as AdminAssessment,
} from "@/services/assessments";
import { fetchCourses } from "@/services/courses";
import { useSemesterStore } from "@/stores/semesterStore";
import { useAuth } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { DatePicker } from "@/components/DatePicker";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  List,
  Search,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ExternalLink,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  Beaker,
  FolderKanban,
  Shuffle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GroupOrderGenerator } from "@/components/GroupOrderGenerator";
import { toast } from "@/hooks/use-toast";
import { CourseSelectDropdown } from "@/components/CourseSelectDropdown";

// ─── Source styling ───
const sourceConfig: Record<string, { label: string; className: string; icon: typeof FileText }> = {
  classroom: { label: "Classroom", className: "bg-primary/10 text-primary border-primary/30", icon: GraduationCap },
  direct: { label: "Direct Call", className: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: ExternalLink },
  notice: { label: "Notice Board", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: FileText },
  other: { label: "Other", className: "bg-muted text-muted-foreground border-border", icon: FileText },
};

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock },
  submitted: { label: "Submitted", className: "bg-primary/10 text-primary border-primary/30", icon: CheckCircle2 },
  graded: { label: "Graded", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
};

const assessmentTypeConfig: Record<string, { label: string; icon: typeof BookOpen; className: string }> = {
  exam: { label: "Exam", icon: ClipboardList, className: "bg-destructive/10 text-destructive border-destructive/30" },
  quiz: { label: "Quiz", icon: Beaker, className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  assignment: { label: "Assignment", icon: FileText, className: "bg-primary/10 text-primary border-primary/30" },
  project: { label: "Project", icon: FolderKanban, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  other: { label: "Other", icon: BookOpen, className: "bg-muted text-muted-foreground border-border" },
};
type AssessmentSource = NonNullable<AdminAssessment["source"]>;
const sourceOptions: Array<{ value: AssessmentSource; label: string }> = [
  { value: "classroom", label: sourceConfig.classroom.label },
  { value: "direct", label: sourceConfig.direct.label },
  { value: "notice", label: sourceConfig.notice.label },
  { value: "other", label: sourceConfig.other.label },
];

// ─── Confidence types ───
type ConfidenceVote = "confident" | "neutral" | "struggling";
type AssessmentFormValues = Omit<AdminAssessment, "id" | "createdAt" | "updatedAt">;

function getAggregatedConfidence(vote: ConfidenceVote | undefined) {
  return {
    confident: vote === "confident" ? 100 : 0,
    neutral: vote === "neutral" ? 100 : 0,
    struggling: vote === "struggling" ? 100 : 0,
  };
}

function getDistributionPercentages(assignment: Assignment) {
  if (assignment.confidencePercentages) {
    return assignment.confidencePercentages;
  }

  const dist = assignment.confidenceDistribution;
  if (!dist || dist.total <= 0) {
    return getAggregatedConfidence((assignment.userConfidence || undefined) as ConfidenceVote | undefined);
  }

  return {
    confident: Math.round((dist.confident / dist.total) * 100),
    neutral: Math.round((dist.neutral / dist.total) * 100),
    struggling: Math.round((dist.struggling / dist.total) * 100),
  };
}

function isEdited(item: { createdAt?: string; updatedAt?: string }) {
  if (!item.createdAt || !item.updatedAt) return false;
  const created = new Date(item.createdAt).getTime();
  const updated = new Date(item.updatedAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created > 1000;
}

function formatEditedAtLocal(updatedAt?: string) {
  if (!updatedAt) return "";
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function parseAssessmentDate(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const parsed = new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDaysUntilDue(dueDate: string | null, baseDate = new Date()) {
  const parsed = parseAssessmentDate(dueDate);
  if (!parsed) return null;
  const due = startOfLocalDay(parsed);
  const base = startOfLocalDay(baseDate);
  return Math.round((due.getTime() - base.getTime()) / DAY_IN_MS);
}

function formatDaysUntilDue(daysUntilDue: number | null) {
  if (daysUntilDue === null) return "TBA";
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}d overdue`;
  if (daysUntilDue === 0) return "Due today";
  return `Due in ${daysUntilDue}d`;
}

function getDeadlineBadge(daysUntilDue: number | null, status: Assignment["status"]) {
  if (status !== "pending") {
    return {
      label: status === "submitted" ? "Submitted" : "Completed",
      className: "bg-primary/10 text-primary border-primary/30",
      dotClassName: "bg-primary",
    };
  }

  if (daysUntilDue === null) {
    return {
      label: "TBA",
      className: "bg-muted text-muted-foreground border-border",
      dotClassName: "bg-muted-foreground/70",
    };
  }

  if (daysUntilDue < 0) {
    return {
      label: `${Math.abs(daysUntilDue)}d overdue`,
      className: "bg-destructive/10 text-destructive border-destructive/30",
      dotClassName: "bg-destructive",
    };
  }
  if (daysUntilDue === 0) {
    return {
      label: "Due today",
      className: "bg-destructive/10 text-destructive border-destructive/30",
      dotClassName: "bg-destructive",
    };
  }
  if (daysUntilDue <= 3) {
    return {
      label: `Due in ${daysUntilDue}d`,
      className: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      dotClassName: "bg-amber-500",
    };
  }
  return {
    label: `Due in ${daysUntilDue}d`,
    className: "bg-primary/10 text-primary border-primary/30",
    dotClassName: "bg-primary",
  };
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type AcademicsViewMode = "calendar" | "list";

function compareAssignmentsByUrgency(a: Assignment, b: Assignment, baseDate: Date) {
  const statusPriority: Record<Assignment["status"], number> = {
    pending: 0,
    submitted: 1,
    graded: 2,
  };

  const aDays = getDaysUntilDue(a.dueDate, baseDate);
  const bDays = getDaysUntilDue(b.dueDate, baseDate);
  const normalizedADays = aDays ?? Number.POSITIVE_INFINITY;
  const normalizedBDays = bDays ?? Number.POSITIVE_INFINITY;
  const dayDiff = normalizedADays - normalizedBDays;
  if (dayDiff !== 0) return dayDiff;

  const statusDiff = statusPriority[a.status] - statusPriority[b.status];
  if (statusDiff !== 0) return statusDiff;

  return a.title.localeCompare(b.title);
}

function ConfidenceButton({ type, active, onClick }: { type: ConfidenceVote; active: boolean; onClick: () => void }) {
  const config = {
    confident: { icon: ThumbsUp, label: "Confident", activeClass: "bg-emerald-500/15 border-emerald-500/50 text-emerald-600" },
    neutral: { icon: Minus, label: "Neutral", activeClass: "bg-amber-500/15 border-amber-500/50 text-amber-600" },
    struggling: { icon: ThumbsDown, label: "Struggling", activeClass: "bg-destructive/15 border-destructive/50 text-destructive" },
  }[type];
  const Icon = config.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] font-bold uppercase tracking-wider transition-all",
        active ? config.activeClass : "border-border text-muted-foreground hover:bg-accent"
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </button>
  );
}

function ConfidenceBar({ data }: { data: { confident: number; neutral: number; struggling: number } }) {
  return (
    <div className="flex h-1.5 overflow-hidden">
      <div className="bg-emerald-500" style={{ width: `${data.confident}%` }} />
      <div className="bg-amber-500" style={{ width: `${data.neutral}%` }} />
      <div className="bg-destructive" style={{ width: `${data.struggling}%` }} />
    </div>
  );
}

// ─── Assessment Form Dialog ───
function AssessmentFormDialog({
  open,
  onOpenChange,
  initial,
  semesterId,
  getCourseName,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: AdminAssessment | null;
  semesterId: string;
  getCourseName: (code: string) => string;
  onSave: (a: AssessmentFormValues) => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [type, setType] = useState<AdminAssessment["type"]>(initial?.type || "assignment");
  const [courseCode, setCourseCode] = useState(initial?.courseCode || "");
  const [selectedCourseSemesterId, setSelectedCourseSemesterId] = useState(initial?.semesterId || "");
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [maxScore, setMaxScore] = useState(String(initial?.maxScore || 100));
  const [weight, setWeight] = useState(String(initial?.weight || 10));
  const [source, setSource] = useState<AssessmentSource>(initial?.source || "classroom");
  
  useEffect(() => {
    setTitle(initial?.title || "");
    setType(initial?.type || "assignment");
    setCourseCode(initial?.courseCode || "");
    setSelectedCourseSemesterId(initial?.semesterId || "");
    setDueDate(initial?.dueDate || "");
    setDescription(initial?.description || "");
    setMaxScore(String(initial?.maxScore || 100));
    setWeight(String(initial?.weight || 10));
    setSource(initial?.source || "classroom");
  }, [initial, open]);

  const isValid = Boolean(title.trim() && courseCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">
            {initial ? "Edit Assessment" : "Add Assessment"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midterm Exam" className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as AdminAssessment["type"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exam">Exam</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                  <SelectItem value="assignment">Assignment</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Course</label>
              <CourseSelectDropdown
                value={courseCode || undefined}
                onChange={(value, course) => {
                  setCourseCode(value === "none" || value === "all" ? "" : value);
                  setSelectedCourseSemesterId(course?.semesterId || "");
                }}
                placeholder="Select course"
                className="w-full h-9 text-xs"
                selectedLabel={
                  courseCode
                    ? getCourseName(courseCode) !== courseCode
                      ? `${courseCode} — ${getCourseName(courseCode)}`
                      : courseCode
                    : undefined
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Due Date</label>
              <DatePicker value={dueDate} onChange={setDueDate} placeholder="Due date" />
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {dueDate ? "Set" : "No due date (TBA)"}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] uppercase tracking-wider"
                  onClick={() => setDueDate("")}
                  disabled={!dueDate}
                >
                  Set TBA
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Max Score</label>
              <Input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Weight %</label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Source</label>
            <Select value={source} onValueChange={(v) => setSource(v as AssessmentSource)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sourceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Assessment details..." className="text-sm min-h-[80px]" />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!isValid}
              onClick={() => {
                onSave({
                  title: title.trim(),
                  type,
                  courseCode,
                  dueDate: dueDate || null,
                  description: description.trim(),
                  maxScore: Number(maxScore),
                  weight: Number(weight),
                  semesterId: semesterId || selectedCourseSemesterId || initial?.semesterId || "",
                  source,
                  ...(initial?.status ? { status: initial.status } : {}),
                });
                onOpenChange(false);
              }}
            >
              {initial ? <><Pencil className="h-3 w-3" /> Save</> : <><Plus className="h-3 w-3" /> Add</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assessment Card (Admin view) ───
function AssessmentCard({
  assessment,
  courseName,
  isAdmin,
  onEdit,
  onDelete,
}: {
  assessment: AdminAssessment;
  courseName: string;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeInfo = assessmentTypeConfig[assessment.type];
  const TypeIcon = typeInfo.icon;
  const edited = isEdited(assessment);
  const daysUntilDue = getDaysUntilDue(assessment.dueDate);
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
  const isDueSoon = daysUntilDue !== null && daysUntilDue <= 2 && daysUntilDue >= 0;

  return (
    <div className="border border-border bg-card p-3 sm:p-4 hover:bg-card transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2">
            {isOverdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm">{assessment.title}</p>
                {edited && (
                  <span className="px-1.5 py-0.5 border border-border text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Edited
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {courseName} ·{" "}
                <span className={cn(
                  isOverdue && "text-destructive font-medium",
                  !isOverdue && isDueSoon && "text-amber-600 font-medium",
                  daysUntilDue === null && "text-muted-foreground",
                )}>
                  {formatDaysUntilDue(daysUntilDue)}
                </span>
              </p>
            </div>
          </div>
          {assessment.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{assessment.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", typeInfo.className)}>
              <TypeIcon className="h-2.5 w-2.5" />
              {typeInfo.label}
            </span>
            <span className="px-1.5 py-0.5 border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {assessment.maxScore} pts
            </span>
            <span className="px-1.5 py-0.5 border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {assessment.weight}%
            </span>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Student Assignment Row (with confidence) ───
function AssignmentRow({
  assignment,
  onVote,
  onClick,
}: {
  assignment: Assignment;
  onVote: (assignment: Assignment, v: ConfidenceVote) => void;
  onClick: () => void;
}) {
  const vote = assignment.userConfidence || undefined;
  const source = sourceConfig[assignment.source];
  const status = statusConfig[assignment.status];
  const SourceIcon = source.icon;
  const daysUntilDue = getDaysUntilDue(assignment.dueDate);
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && assignment.status === "pending";
  const isDueSoon = daysUntilDue !== null && daysUntilDue <= 2 && daysUntilDue >= 0 && assignment.status === "pending";
  const aggregated = getDistributionPercentages(assignment);
  const totalVotes = assignment.confidenceDistribution?.total || 0;
  const edited = isEdited(assignment);

  return (
    <div className="border border-border bg-card p-3 sm:p-4 hover:bg-card transition-colors cursor-pointer" onClick={onClick}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2">
            {isOverdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{assignment.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assignment.course} ·{" "}
                <span className={cn(
                  isOverdue && "text-destructive font-medium",
                  isDueSoon && "text-amber-600 font-medium",
                  daysUntilDue === null && "text-muted-foreground",
                )}>
                  {formatDaysUntilDue(daysUntilDue)}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", source.className)}>
              <SourceIcon className="h-2.5 w-2.5" />
              {source.label}
            </span>
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", status.className)}>
              {status.label}
            </span>
            {edited && (
              <span className="px-1.5 py-0.5 border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Edited
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {(["confident", "neutral", "struggling"] as ConfidenceVote[]).map((v) => (
            <ConfidenceButton key={v} type={v} active={vote === v} onClick={() => onVote(assignment, v)} />
          ))}
        </div>
      </div>
      <div className="mt-2">
        <ConfidenceBar data={aggregated} />
        <p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{totalVotes} votes</p>
      </div>
    </div>
  );
}

// ─── Assignment Detail Dialog ───
function AssignmentDetailDialog({
  assignment,
  onVote,
  getCourseName,
  isAdmin,
  onEdit,
  onDelete,
  onClose,
}: {
  assignment: Assignment | null;
  onVote: (assignment: Assignment, v: ConfidenceVote) => void;
  getCourseName: (code: string) => string;
  isAdmin: boolean;
  onEdit: (assignment: Assignment) => void;
  onDelete: (assignment: Assignment) => void;
  onClose: () => void;
}) {
  if (!assignment) return null;
  const vote = assignment.userConfidence || undefined;
  const source = sourceConfig[assignment.source];
  const status = statusConfig[assignment.status];
  const SourceIcon = source.icon;
  const StatusIcon = status.icon;
  const courseName = getCourseName(assignment.course);
  const dueDate = parseAssessmentDate(assignment.dueDate);
  const daysUntilDue = getDaysUntilDue(assignment.dueDate);
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && assignment.status === "pending";
  const aggregated = getDistributionPercentages(assignment);
  const totalVotes = assignment.confidenceDistribution?.total || 0;
  const edited = isEdited(assignment);
  const editedAtLabel = formatEditedAtLocal(assignment.updatedAt);

  return (
    <Dialog open={!!assignment} onOpenChange={() => onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">Assignment Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold break-words">{assignment.title}</h3>
              {edited && (
                <span className="px-1.5 py-0.5 border border-border text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Edited
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 break-words">{courseName}</p>
            {edited && assignment.updatedAt && (
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                Edited {editedAtLabel}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Source</p>
              <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 border text-xs font-medium", source.className)}>
                <SourceIcon className="h-3 w-3" />
                {source.label}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</p>
              <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 border text-xs font-medium", status.className)}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Due Date</p>
            <p className={cn("text-sm font-bold break-words", isOverdue && "text-destructive")}>
              {dueDate
                ? dueDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                : "TBA"}
              {isOverdue && daysUntilDue !== null && <span className="ml-2 text-xs font-medium">({Math.abs(daysUntilDue)}d overdue)</span>}
              {!isOverdue && dueDate && daysUntilDue !== null && daysUntilDue >= 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({daysUntilDue === 0 ? "Today" : `${daysUntilDue}d left`})
                </span>
              )}
            </p>
          </div>
          <div className="border border-border p-3 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Confidence Check</p>
            <div className="flex flex-wrap gap-2">
              {(["confident", "neutral", "struggling"] as ConfidenceVote[]).map((v) => (
                <ConfidenceButton key={v} type={v} active={vote === v} onClick={() => onVote(assignment, v)} />
              ))}
            </div>
            <ConfidenceBar data={aggregated} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
              <span>{totalVotes} votes</span>
              <span>{aggregated.confident}% confident</span>
              <span>{aggregated.neutral}% neutral</span>
              <span>{aggregated.struggling}% struggling</span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs w-full sm:w-auto" onClick={() => onEdit(assignment)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive w-full sm:w-auto" onClick={() => onDelete(assignment)}>
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssessmentCalendarView({
  assignments,
  selectedDateKey,
  onSelectDateKey,
  visibleMonth,
  onVisibleMonthChange,
  getCourseName,
  onAssignmentClick,
}: {
  assignments: Assignment[];
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  visibleMonth: Date;
  onVisibleMonthChange: (date: Date) => void;
  getCourseName: (courseCode: string) => string;
  onAssignmentClick: (assignment: Assignment) => void;
}) {
  const today = startOfLocalDay(new Date());
  const todayKey = toDateKey(today);
  const selectedDate = parseDateKey(selectedDateKey) || today;
  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const leadingDays = (monthStart.getDay() + 6) % 7;
  const calendarStart = addDays(monthStart, -leadingDays);
  const calendarDays = Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));
  const baseDateForSort = parseDateKey(todayKey) || today;

  const assignmentsByDate = useMemo(() => {
    const grouped = new Map<string, Assignment[]>();
    assignments.forEach((assignment) => {
      const due = parseAssessmentDate(assignment.dueDate);
      if (!due) return;
      const dateKey = toDateKey(due);
      const current = grouped.get(dateKey) || [];
      current.push(assignment);
      grouped.set(dateKey, current);
    });

    grouped.forEach((items) => {
      items.sort((a, b) => compareAssignmentsByUrgency(a, b, baseDateForSort));
    });

    return grouped;
  }, [assignments, baseDateForSort]);

  const selectedDayAssignments = assignmentsByDate.get(selectedDateKey) || [];
  const sortedByUrgency = useMemo(
    () => [...assignments].sort((a, b) => compareAssignmentsByUrgency(a, b, baseDateForSort)),
    [assignments, baseDateForSort],
  );

  const upcomingAssignments = sortedByUrgency.slice(0, 6);
  const pendingAssignments = assignments.filter((assignment) => assignment.status === "pending");
  const overdueCount = pendingAssignments.filter((assignment) => {
    const days = getDaysUntilDue(assignment.dueDate, today);
    return days !== null && days < 0;
  }).length;
  const dueTodayCount = pendingAssignments.filter((assignment) => getDaysUntilDue(assignment.dueDate, today) === 0).length;
  const thisWeekCount = pendingAssignments.filter((assignment) => {
    const days = getDaysUntilDue(assignment.dueDate, today);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</p>
          <p className="mt-1 text-xl font-black tabular-nums">{pendingAssignments.length}</p>
        </div>
        <div className="border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-destructive">Overdue</p>
          <p className="mt-1 text-xl font-black tabular-nums text-destructive">{overdueCount}</p>
        </div>
        <div className="border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-amber-600">Due Today</p>
          <p className="mt-1 text-xl font-black tabular-nums text-amber-600">{dueTodayCount}</p>
        </div>
        <div className="border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-primary">Next 7 Days</p>
          <p className="mt-1 text-xl font-black tabular-nums text-primary">{thisWeekCount}</p>
        </div>
      </div>

      <div className="border border-border bg-card overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Calendar</p>
            <p className="text-lg sm:text-xl font-black uppercase tracking-wider">{monthLabel}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5"
              onClick={() => onVisibleMonthChange(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs px-2.5"
              onClick={() => {
                onVisibleMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
                onSelectDateKey(todayKey);
              }}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5"
              onClick={() => onVisibleMonthChange(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-border bg-muted/20">
          {WEEKDAY_LABELS.map((label) => (
            <p
              key={label}
              className="py-2 text-center text-[10px] sm:text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground"
            >
              {label}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[84px] sm:auto-rows-[108px] md:auto-rows-[124px]">
          {calendarDays.map((date) => {
            const dateKey = toDateKey(date);
            const dayAssignments = assignmentsByDate.get(dateKey) || [];
            const urgentCount = dayAssignments.filter((assignment) => {
              const days = getDaysUntilDue(assignment.dueDate, today);
              return assignment.status === "pending" && days !== null && days <= 3;
            }).length;
            const isOutsideMonth = date.getMonth() !== monthStart.getMonth();
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDateKey;

            return (
              <button
                key={dateKey}
                onClick={() => onSelectDateKey(dateKey)}
                className={cn(
                  "relative border-r border-b border-border p-1.5 sm:p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected && "bg-accent/60",
                  !isSelected && !isOutsideMonth && "hover:bg-accent/30",
                  isOutsideMonth && "bg-muted/10 text-muted-foreground/60",
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center px-1 text-[11px] sm:text-xs font-bold",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {dayAssignments.length > 0 && (
                    <span
                      className={cn(
                        "px-1.5 py-0.5 border text-[9px] font-bold tabular-nums",
                        urgentCount > 0
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : "bg-primary/10 text-primary border-primary/30",
                      )}
                    >
                      {dayAssignments.length}
                    </span>
                  )}
                </div>

                <div className="mt-2 hidden sm:flex flex-col gap-1">
                  {dayAssignments.slice(0, 2).map((assignment) => {
                    const badge = getDeadlineBadge(getDaysUntilDue(assignment.dueDate, today), assignment.status);
                    return (
                      <div
                        key={assignment.id}
                        className={cn(
                          "w-full border px-1.5 py-1 text-[10px] leading-tight truncate font-medium",
                          badge.className,
                        )}
                      >
                        {assignment.title}
                      </div>
                    );
                  })}
                  {dayAssignments.length > 2 && (
                    <span className="text-[9px] text-muted-foreground">+{dayAssignments.length - 2} more</span>
                  )}
                </div>

                <div className="mt-2 flex sm:hidden items-center gap-1">
                  {dayAssignments.slice(0, 3).map((assignment) => {
                    const badge = getDeadlineBadge(getDaysUntilDue(assignment.dueDate, today), assignment.status);
                    return <span key={assignment.id} className={cn("h-1.5 w-1.5", badge.dotClassName)} />;
                  })}
                  {dayAssignments.length > 3 && (
                    <span className="text-[9px] text-muted-foreground">+{dayAssignments.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <div className="border border-border bg-card">
          <div className="p-3 border-b border-border flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Selected Date</p>
              <p className="text-sm sm:text-base font-black uppercase tracking-wider">
                {selectedDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            {selectedDateKey === todayKey && (
              <span className="px-2 py-1 border border-primary/30 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                Today
              </span>
            )}
          </div>

          <div className="p-3 space-y-2">
            {selectedDayAssignments.length === 0 ? (
              <div className="border border-dashed border-muted-foreground/30 p-6 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">No deadlines on this day</p>
              </div>
            ) : (
              selectedDayAssignments.map((assignment) => {
                const daysUntilDue = getDaysUntilDue(assignment.dueDate, today);
                const badge = getDeadlineBadge(daysUntilDue, assignment.status);
                const source = sourceConfig[assignment.source];
                const SourceIcon = source.icon;
                return (
                  <button
                    key={assignment.id}
                    onClick={() => onAssignmentClick(assignment)}
                    className="w-full border border-border bg-card p-3 text-left hover:bg-card transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{assignment.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {assignment.course} · {getCourseName(assignment.course)}
                        </p>
                      </div>
                      <span className={cn("px-1.5 py-0.5 border text-[9px] font-bold uppercase tracking-wider", badge.className)}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", source.className)}>
                        <SourceIcon className="h-2.5 w-2.5" />
                        {source.label}
                      </span>
                      <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", statusConfig[assignment.status].className)}>
                        {statusConfig[assignment.status].label}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="border border-border bg-card">
          <div className="p-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Next Deadlines</p>
            <p className="text-sm font-black uppercase tracking-wider">Relative to Today</p>
          </div>
          <div className="p-3 space-y-2">
            {upcomingAssignments.length === 0 ? (
              <p className="text-xs uppercase tracking-wider text-muted-foreground">No assessments available</p>
            ) : (
              upcomingAssignments.map((assignment) => {
                const due = parseAssessmentDate(assignment.dueDate);
                const daysUntilDue = getDaysUntilDue(assignment.dueDate, today);
                const badge = getDeadlineBadge(daysUntilDue, assignment.status);
                const dueLabel = due ? due.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBA";
                return (
                  <button
                    key={assignment.id}
                    onClick={() => onAssignmentClick(assignment)}
                    className="w-full border border-border bg-card p-2.5 text-left hover:bg-card transition-colors"
                  >
                    <p className="text-sm font-semibold truncate">{assignment.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {assignment.course} · {dueLabel}
                    </p>
                    <span className={cn("mt-1 inline-flex px-1.5 py-0.5 border text-[9px] font-bold uppercase tracking-wider", badge.className)}>
                      {badge.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
const Academics = () => {
  const { isAdmin } = useAuth();
  const semId = useSemesterStore((s) => s.activeSemester?.id);
  const classroomId = useClassroomStore((s) => s.activeClassroom?.id);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [detailAssignment, setDetailAssignment] = useState<Assignment | null>(null);
  const [viewMode, setViewMode] = useState<AcademicsViewMode>("list");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const today = startOfLocalDay(new Date());
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState<string>(() => toDateKey(startOfLocalDay(new Date())));

  const serverFilters = useMemo(
    () => ({
      semesterId: semId,
      search: search.trim() || undefined,
      courseCode: filterCourse !== "all" ? filterCourse : undefined,
      status: filterStatus !== "all" ? (filterStatus as "pending" | "submitted" | "graded") : undefined,
      source: filterSource !== "all" ? (filterSource as "classroom" | "direct" | "notice" | "other") : undefined,
    }),
    [semId, search, filterCourse, filterStatus, filterSource],
  );

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments", serverFilters],
    queryFn: () => fetchAssignments(serverFilters),
    enabled: !!classroomId,
  });
  const statsQuery = useQuery({
    queryKey: ["assessment-stats", serverFilters],
    queryFn: () => fetchAssessmentStats(serverFilters),
    enabled: !!classroomId,
  });
  const coursesQuery = useQuery({
    queryKey: ["courses", classroomId],
    queryFn: () => fetchCourses({ page: 1, limit: 100 }),
    enabled: !!classroomId,
  });
  const courses = useMemo(
    () =>
      (coursesQuery.data?.data || [])
        .filter((course) => Boolean(course.code?.trim()))
        .map((course) => ({ code: course.code!.trim(), name: course.name })),
    [coursesQuery.data],
  );
  const courseNameByCode = useMemo(
    () => new Map(courses.map((course) => [course.code, course.name])),
    [courses],
  );
  const getCourseName = (code: string) => courseNameByCode.get(code) || code;

  // Admin assessments
  const [assessFormOpen, setAssessFormOpen] = useState(false);
  const [editingAssess, setEditingAssess] = useState<AdminAssessment | null>(null);
  const [deletingAssessId, setDeletingAssessId] = useState<string | null>(null);
  const [groupOrderOpen, setGroupOrderOpen] = useState(false);
  const assessmentsQuery = useQuery({
    queryKey: ["assessments", semId, classroomId],
    queryFn: () => loadAssessments(semId),
    enabled: !!classroomId,
  });
  const assessments = assessmentsQuery.data || [];

  const saveAssessmentMutation = useMutation({
    mutationFn: async ({
      mode,
      id,
      assessment,
    }: {
      mode: "create" | "update";
      id?: string;
      assessment: AssessmentFormValues;
    }) => {
      const semesterId = assessment.semesterId || semId;
      if (!semesterId) {
        throw new Error("Please select an active semester before saving assessments.");
      }

      const payload = {
        title: assessment.title,
        type: assessment.type,
        courseCode: assessment.courseCode,
        dueDate: assessment.dueDate,
        description: assessment.description || "",
        maxScore: assessment.maxScore,
        weight: assessment.weight,
        semesterId,
        ...(assessment.status ? { status: assessment.status } : {}),
        ...(assessment.source ? { source: assessment.source } : {}),
      };

      if (mode === "update" && id) {
        return updateAssessment(id, payload);
      }
      return createAssessment(payload);
    },
    onSuccess: async (_saved, vars) => {
      setEditingAssess(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assessments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assessment-stats"] }),
      ]);
      toast({
        title: vars.mode === "update" ? "Updated" : "Created",
        description: `${vars.assessment.title} saved.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Could not save assessment",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const deleteAssessmentMutation = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => deleteAssessment(id),
    onSuccess: async (_res, vars) => {
      setDeletingAssessId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assessments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assessment-stats"] }),
      ]);
      toast({ title: "Deleted", description: `${vars.name} removed.` });
    },
    onError: (error) => {
      toast({
        title: "Could not delete assessment",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const handleSaveAssessment = (assessment: AssessmentFormValues) => {
    saveAssessmentMutation.mutate({
      mode: editingAssess ? "update" : "create",
      id: editingAssess?.id,
      assessment,
    });
  };

  const handleDeleteAssessment = () => {
    if (!deletingAssessId) return;
    const name = assessments.find((a) => a.id === deletingAssessId)?.title || "Assessment";
    deleteAssessmentMutation.mutate({ id: deletingAssessId, name });
  };

  const handleEditFromDetail = async (assignment: Assignment) => {
    let target = assessments.find((a) => a.id === assignment.id);

    if (!target) {
      try {
        const refreshed = await queryClient.fetchQuery({
          queryKey: ["assessments", semId, classroomId, "resolve-edit"],
          queryFn: () => loadAssessments(semId),
        });
        target = refreshed.find((a) => a.id === assignment.id);
      } catch {
        // fallback to the assignment payload below if assessment lookup fails
      }
    }

    // Last-resort fallback so edit dialog still opens.
    if (!target) {
      target = {
        id: assignment.id,
        title: assignment.title,
        type: "assignment",
        courseCode: assignment.course,
        dueDate: assignment.dueDate,
        description: "",
        maxScore: 100,
        weight: 10,
        semesterId: semId || "",
        createdAt: assignment.createdAt || new Date().toISOString(),
        updatedAt: assignment.updatedAt,
        status: assignment.status,
        source: assignment.source,
      };
    }

    setDetailAssignment(null);
    setEditingAssess(target);
    setAssessFormOpen(true);
  };

  const handleDeleteFromDetail = (assignment: Assignment) => {
    setDetailAssignment(null);
    setDeletingAssessId(assignment.id);
  };

  const confidenceMutation = useMutation({
    mutationFn: async ({ assignment, vote }: { assignment: Assignment; vote: ConfidenceVote }) => {
      if (assignment.userConfidence === vote) {
        return clearAssignmentConfidence(assignment.id);
      }
      return rateAssignmentConfidence(assignment.id, vote);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assessments"] }),
      ]);
    },
    onError: (error) => {
      toast({
        title: "Could not save confidence rating",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const handleVote = (assignment: Assignment, vote: ConfidenceVote) => {
    confidenceMutation.mutate({ assignment, vote });
  };

  const coursesInData = useMemo(() => {
    if (courses.length > 0) return courses.map((c) => c.code).sort();
    if (!assignments) return [];
    return [...new Set(assignments.map((a) => a.course))].sort();
  }, [assignments, courses]);

  const filtered = assignments || [];

  useEffect(() => {
    if (!detailAssignment || !assignments) return;
    const latest = assignments.find((item) => item.id === detailAssignment.id);
    if (latest) {
      setDetailAssignment(latest);
    }
  }, [assignments, detailAssignment]);

  const stats = statsQuery.data || { total: 0, pending: 0, submitted: 0, overdue: 0 };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Tracker</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Assessments</h1>
        </div>
        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setGroupOrderOpen(true)}>
              <Shuffle className="h-3 w-3" /> Group Order
            </Button>
            <Button size="sm" className="w-full sm:w-auto" onClick={() => { setEditingAssess(null); setAssessFormOpen(true); }}>
              <Plus className="h-3 w-3" /> Add Assessment
            </Button>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
            <p className="text-2xl font-black tabular-nums mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-widest text-amber-600">Pending</p>
            <p className="text-2xl font-black tabular-nums mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-widest text-primary">Submitted</p>
            <p className="text-2xl font-black tabular-nums mt-1">{stats.submitted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className={cn("text-[10px] uppercase tracking-widest", stats.overdue > 0 ? "text-destructive" : "text-muted-foreground")}>Overdue</p>
            <p className={cn("text-2xl font-black tabular-nums mt-1", stats.overdue > 0 && "text-destructive")}>{stats.overdue}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search assignments, courses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-widest font-bold">Filters</span>
            </div>
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {coursesInData.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="graded">Graded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sourceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterCourse !== "all" || filterStatus !== "all" || filterSource !== "all" || search) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterCourse("all"); setFilterStatus("all"); setFilterSource("all"); setSearch(""); }}>
                Clear
              </Button>
            )}
          </div>
          <div className="inline-flex items-center gap-1 border border-border bg-muted/30 p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setViewMode("list")}
            >
              <List className="h-3 w-3" />
              List
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "calendar" ? "default" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="h-3 w-3" />
              Calendar
            </Button>
          </div>
        </div>
      </div>

      {/* Assignment list */}
      {isLoading ? (
        viewMode === "calendar" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border border-border p-3 space-y-2">
                  <div className="h-2.5 w-20 bg-muted animate-pulse" />
                  <div className="h-6 w-12 bg-muted animate-pulse" />
                </div>
              ))}
            </div>
            <div className="border border-border bg-card p-3 sm:p-4 space-y-3">
              <div className="h-4 w-36 bg-muted animate-pulse" />
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }, (_, i) => (
                  <div key={i} className="h-16 sm:h-20 border border-border bg-muted/40 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border bg-card p-3 flex items-center gap-3">
                <div className="h-8 w-8 bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-36 bg-muted animate-pulse" />
                  <div className="h-2.5 w-48 bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 p-12 flex flex-col items-center gap-2">
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm uppercase tracking-wider text-muted-foreground">No assignments match filters</p>
        </div>
      ) : viewMode === "calendar" ? (
        <AssessmentCalendarView
          assignments={filtered}
          selectedDateKey={selectedCalendarDateKey}
          onSelectDateKey={setSelectedCalendarDateKey}
          visibleMonth={calendarMonth}
          onVisibleMonthChange={setCalendarMonth}
          getCourseName={getCourseName}
          onAssignmentClick={setDetailAssignment}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((assignment) => (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              onVote={handleVote}
              onClick={() => setDetailAssignment(assignment)}
            />
          ))}
        </div>
      )}

      {/* Confidence legend */}
      {viewMode === "list" && (
        <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-muted-foreground border-t border-border pt-4">
          <p className="font-bold">Confidence Check</p>
          <div className="flex items-center gap-1"><div className="w-3 h-1.5 bg-emerald-500" /><span>Confident</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-1.5 bg-amber-500" /><span>Neutral</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-1.5 bg-destructive" /><span>Struggling</span></div>
        </div>
      )}

      {/* Detail dialog */}
      <AssignmentDetailDialog
        assignment={detailAssignment}
        onVote={handleVote}
        getCourseName={getCourseName}
        isAdmin={isAdmin}
        onEdit={handleEditFromDetail}
        onDelete={handleDeleteFromDetail}
        onClose={() => setDetailAssignment(null)}
      />

      {/* Assessment form dialog */}
      {isAdmin && (
        <>
          <AssessmentFormDialog
            open={assessFormOpen}
            onOpenChange={(o) => { setAssessFormOpen(o); if (!o) setEditingAssess(null); }}
            initial={editingAssess}
            semesterId={semId || ""}
            getCourseName={getCourseName}
            onSave={handleSaveAssessment}
          />
          <Dialog open={groupOrderOpen} onOpenChange={setGroupOrderOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="uppercase tracking-wider text-sm">Group Order Generator</DialogTitle>
              </DialogHeader>
              <GroupOrderGenerator embedded />
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Delete assessment confirmation */}
      <AlertDialog open={!!deletingAssessId} onOpenChange={(o) => !o && setDeletingAssessId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assessment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This assessment will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAssessment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Academics;
