import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAssignments, COURSES, type Assignment } from "@/services/api";
import { loadAssessments, saveAssessment, deleteAssessment, type Assessment as AdminAssessment } from "@/services/assessments";
import { useSemesterStore } from "@/stores/semesterStore";
import { useAuth } from "@/stores/authStore";
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
  FileText,
  Filter,
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
import { toast } from "@/hooks/use-toast";
import { GroupOrderGenerator } from "@/components/GroupOrderGenerator";
import { Dialog, DialogContent as GroupDialogContent, DialogHeader as GroupDialogHeader, DialogTitle as GroupDialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

// ─── Source styling ───
const sourceConfig: Record<string, { label: string; className: string; icon: typeof FileText }> = {
  classroom: { label: "Classroom", className: "bg-primary/10 text-primary border-primary/30", icon: GraduationCap },
  direct: { label: "Direct Call", className: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: ExternalLink },
  notice: { label: "Notice Board", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: FileText },
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
};

// ─── Confidence types ───
type ConfidenceVote = "confident" | "neutral" | "struggling";
interface ConfidenceState { [assignmentId: string]: ConfidenceVote }

function getMockAggregated(vote: ConfidenceVote | undefined) {
  const base = { confident: 42, neutral: 35, struggling: 23 };
  if (vote === "confident") return { confident: 48, neutral: 32, struggling: 20 };
  if (vote === "struggling") return { confident: 38, neutral: 33, struggling: 29 };
  return base;
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
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: AdminAssessment | null;
  semesterId: string;
  onSave: (a: AdminAssessment) => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [type, setType] = useState<AdminAssessment["type"]>(initial?.type || "assignment");
  const [courseCode, setCourseCode] = useState(initial?.courseCode || "");
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [maxScore, setMaxScore] = useState(String(initial?.maxScore || 100));
  const [weight, setWeight] = useState(String(initial?.weight || 10));

  const isValid = title.trim() && courseCode && dueDate;

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
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Course</label>
              <Select value={courseCode} onValueChange={setCourseCode}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {COURSES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Due Date</label>
              <DatePicker value={dueDate} onChange={setDueDate} placeholder="Due date" />
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
                  id: initial?.id || `assess-${Date.now()}`,
                  title: title.trim(),
                  type,
                  courseCode,
                  dueDate,
                  description: description.trim(),
                  maxScore: Number(maxScore),
                  weight: Number(weight),
                  semesterId,
                  createdAt: initial?.createdAt || new Date().toISOString().split("T")[0],
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
  isAdmin,
  onEdit,
  onDelete,
}: {
  assessment: AdminAssessment;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const typeInfo = assessmentTypeConfig[assessment.type];
  const TypeIcon = typeInfo.icon;
  const courseName = COURSES.find((c) => c.code === assessment.courseCode)?.name || assessment.courseCode;
  const dueDate = new Date(assessment.dueDate);
  const now = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0;

  return (
    <div className="border border-border p-3 sm:p-4 hover:bg-accent/30 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2">
            {isOverdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className="font-bold text-sm">{assessment.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {courseName} ·{" "}
                <span className={cn(isOverdue && "text-destructive font-medium", !isOverdue && daysUntilDue <= 2 && "text-amber-600 font-medium")}>
                  {isOverdue ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue === 0 ? "Due today" : `Due in ${daysUntilDue}d`}
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
  vote,
  onVote,
  onClick,
}: {
  assignment: Assignment;
  vote: ConfidenceVote | undefined;
  onVote: (id: string, v: ConfidenceVote) => void;
  onClick: () => void;
}) {
  const source = sourceConfig[assignment.source];
  const status = statusConfig[assignment.status];
  const SourceIcon = source.icon;
  const dueDate = new Date(assignment.dueDate);
  const now = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0 && assignment.status === "pending";
  const isDueSoon = daysUntilDue <= 2 && daysUntilDue >= 0 && assignment.status === "pending";
  const aggregated = getMockAggregated(vote);

  return (
    <div className="border border-border p-3 sm:p-4 hover:bg-accent/30 transition-colors cursor-pointer" onClick={onClick}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2">
            {isOverdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{assignment.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assignment.course} ·{" "}
                <span className={cn(isOverdue && "text-destructive font-medium", isDueSoon && "text-amber-600 font-medium")}>
                  {isOverdue ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue === 0 ? "Due today" : `Due in ${daysUntilDue}d`}
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
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {(["confident", "neutral", "struggling"] as ConfidenceVote[]).map((v) => (
            <ConfidenceButton key={v} type={v} active={vote === v} onClick={() => onVote(assignment.id, v)} />
          ))}
        </div>
      </div>
      {vote && (
        <div className="mt-2">
          <ConfidenceBar data={aggregated} />
        </div>
      )}
    </div>
  );
}

// ─── Assignment Detail Dialog ───
function AssignmentDetailDialog({
  assignment,
  vote,
  onVote,
  onClose,
}: {
  assignment: Assignment | null;
  vote: ConfidenceVote | undefined;
  onVote: (id: string, v: ConfidenceVote) => void;
  onClose: () => void;
}) {
  if (!assignment) return null;
  const source = sourceConfig[assignment.source];
  const status = statusConfig[assignment.status];
  const SourceIcon = source.icon;
  const StatusIcon = status.icon;
  const courseName = COURSES.find((c) => c.code === assignment.course)?.name || assignment.course;
  const dueDate = new Date(assignment.dueDate);
  const now = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0 && assignment.status === "pending";
  const aggregated = getMockAggregated(vote);

  return (
    <Dialog open={!!assignment} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">Assignment Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <h3 className="text-lg font-bold">{assignment.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{courseName}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <p className={cn("text-sm font-bold", isOverdue && "text-destructive")}>
              {dueDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              {isOverdue && <span className="ml-2 text-xs font-medium">({Math.abs(daysUntilDue)}d overdue)</span>}
              {!isOverdue && daysUntilDue >= 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({daysUntilDue === 0 ? "Today" : `${daysUntilDue}d left`})
                </span>
              )}
            </p>
          </div>
          <div className="border border-border p-3 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Confidence Check</p>
            <div className="flex gap-2">
              {(["confident", "neutral", "struggling"] as ConfidenceVote[]).map((v) => (
                <ConfidenceButton key={v} type={v} active={vote === v} onClick={() => onVote(assignment.id, v)} />
              ))}
            </div>
            <ConfidenceBar data={aggregated} />
            <div className="flex justify-between text-[9px] uppercase tracking-wider text-muted-foreground">
              <span>{aggregated.confident}% confident</span>
              <span>{aggregated.neutral}% neutral</span>
              <span>{aggregated.struggling}% struggling</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───
const Academics = () => {
  const { isAdmin } = useAuth();
  const semId = useSemesterStore((s) => s.activeSemester?.id);
  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments", semId],
    queryFn: () => fetchAssignments(semId),
  });

  // Admin assessments
  const [assessments, setAssessments] = useState<AdminAssessment[]>([]);
  const [assessFormOpen, setAssessFormOpen] = useState(false);
  const [editingAssess, setEditingAssess] = useState<AdminAssessment | null>(null);
  const [deletingAssessId, setDeletingAssessId] = useState<string | null>(null);
  const [groupOrderOpen, setGroupOrderOpen] = useState(false);

  // Reload assessments when semester changes
  useMemo(() => {
    if (semId) setAssessments(loadAssessments(semId));
  }, [semId]);

  const handleSaveAssessment = (a: AdminAssessment) => {
    saveAssessment(a);
    setAssessments(loadAssessments(semId));
    setEditingAssess(null);
    toast({ title: editingAssess ? "Updated" : "Created", description: `${a.title} saved.` });
  };

  const handleDeleteAssessment = () => {
    if (!deletingAssessId) return;
    const name = assessments.find((a) => a.id === deletingAssessId)?.title || "Assessment";
    deleteAssessment(deletingAssessId);
    setAssessments(loadAssessments(semId));
    setDeletingAssessId(null);
    toast({ title: "Deleted", description: `${name} removed.` });
  };

  // Student filters
  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [confidenceVotes, setConfidenceVotes] = useState<ConfidenceState>({});
  const [detailAssignment, setDetailAssignment] = useState<Assignment | null>(null);

  const handleVote = (id: string, vote: ConfidenceVote) => {
    setConfidenceVotes((prev) => ({ ...prev, [id]: prev[id] === vote ? undefined! : vote }));
  };

  const coursesInData = useMemo(() => {
    if (!assignments) return [];
    return [...new Set(assignments.map((a) => a.course))].sort();
  }, [assignments]);

  const filtered = useMemo(() => {
    if (!assignments) return [];
    return assignments.filter((a) => {
      if (filterCourse !== "all" && a.course !== filterCourse) return false;
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      if (filterSource !== "all" && a.source !== filterSource) return false;
      if (search) {
        const q = search.toLowerCase();
        const courseName = COURSES.find((c) => c.code === a.course)?.name || "";
        return a.title.toLowerCase().includes(q) || a.course.toLowerCase().includes(q) || courseName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [assignments, filterCourse, filterStatus, filterSource, search]);

  const stats = useMemo(() => {
    if (!assignments) return { total: 0, pending: 0, submitted: 0, overdue: 0 };
    const now = new Date();
    return {
      total: assignments.length,
      pending: assignments.filter((a) => a.status === "pending").length,
      submitted: assignments.filter((a) => a.status === "submitted" || a.status === "graded").length,
      overdue: assignments.filter((a) => a.status === "pending" && new Date(a.dueDate) < now).length,
    };
  }, [assignments]);

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

      {/* Admin assessments section */}
      {assessments.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
            Assessments ({assessments.length})
          </p>
          {assessments.map((a) => (
            <AssessmentCard
              key={a.id}
              assessment={a}
              isAdmin={isAdmin}
              onEdit={() => { setEditingAssess(a); setAssessFormOpen(true); }}
              onDelete={() => setDeletingAssessId(a.id)}
            />
          ))}
        </div>
      )}

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
              <SelectItem value="classroom">Classroom</SelectItem>
              <SelectItem value="direct">Direct Call</SelectItem>
              <SelectItem value="notice">Notice Board</SelectItem>
            </SelectContent>
          </Select>
          {(filterCourse !== "all" || filterStatus !== "all" || filterSource !== "all" || search) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterCourse("all"); setFilterStatus("all"); setFilterSource("all"); setSearch(""); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Assignment list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border p-3 flex items-center gap-3">
              <div className="h-8 w-8 bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-36 bg-muted animate-pulse" />
                <div className="h-2.5 w-48 bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 p-12 flex flex-col items-center gap-2">
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm uppercase tracking-wider text-muted-foreground">No assignments match filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((assignment) => (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              vote={confidenceVotes[assignment.id]}
              onVote={handleVote}
              onClick={() => setDetailAssignment(assignment)}
            />
          ))}
        </div>
      )}

      {/* Confidence legend */}
      <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-muted-foreground border-t border-border pt-4">
        <p className="font-bold">Confidence Check</p>
        <div className="flex items-center gap-1"><div className="w-3 h-1.5 bg-emerald-500" /><span>Confident</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-1.5 bg-amber-500" /><span>Neutral</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-1.5 bg-destructive" /><span>Struggling</span></div>
      </div>

      {/* Detail dialog */}
      <AssignmentDetailDialog
        assignment={detailAssignment}
        vote={detailAssignment ? confidenceVotes[detailAssignment.id] : undefined}
        onVote={handleVote}
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
