import { useState } from "react";
import {
  type Semester,
} from "@/services/admin";
import { useAuth } from "@/stores/authStore";
import { useSemesterStore } from "@/stores/semesterStore";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Archive,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const statusConfig = {
  active: { label: "Active", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  upcoming: { label: "Upcoming", icon: Clock, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  archived: { label: "Archived", icon: Archive, color: "bg-muted text-muted-foreground border-border" },
};

function SemesterFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Semester | null;
  onSave: (sem: Semester) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [year, setYear] = useState(String(initial?.year || new Date().getFullYear()));
  const [startDate, setStartDate] = useState(initial?.startDate || "");
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [status, setStatus] = useState<Semester["status"]>(initial?.status || "upcoming");
  const [examStart, setExamStart] = useState(initial?.examPeriod?.start || "");
  const [examEnd, setExamEnd] = useState(initial?.examPeriod?.end || "");

  const isValid = name.trim() && startDate && endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">
            {initial ? "Edit Semester" : "Add Semester"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Semester Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall 2026" className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Year</label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as Semester["status"])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Start Date</label>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">End Date</label>
              <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Exam Start</label>
              <DatePicker value={examStart} onChange={setExamStart} placeholder="Exam start" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Exam End</label>
              <DatePicker value={examEnd} onChange={setExamEnd} placeholder="Exam end" />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!isValid}
              onClick={() => {
                onSave({
                  id: initial?.id || `sem-${Date.now()}`,
                  name: name.trim(),
                  year: Number(year),
                  startDate,
                  endDate,
                  status,
                  examPeriod: examStart && examEnd ? { start: examStart, end: examEnd } : undefined,
                  breaks: initial?.breaks || [],
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

// ─── Secure Delete Dialog ───
function DeleteSemesterDialog({
  open,
  semesterName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  semesterName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (password === user?.code) {
      setPassword("");
      setError("");
      onConfirm();
    } else {
      setError("Incorrect verification code. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPassword(""); setError(""); onCancel(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Delete Semester
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-destructive/10 border border-destructive/30 p-3 space-y-2">
            <p className="text-sm font-bold text-destructive">⚠️ This action is irreversible</p>
            <p className="text-xs text-muted-foreground">
              Deleting <strong>"{semesterName}"</strong> will permanently remove the semester and all associated configuration.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Enter your verification code to confirm
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Enter your code"
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setPassword(""); setError(""); onCancel(); }}>
              Cancel
            </Button>
            <Button variant="destructive" className="w-full sm:w-auto" disabled={!password} onClick={handleConfirm}>
              <Trash2 className="h-3 w-3" /> Delete Permanently
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const AdminSemesters = () => {
  const { isOwner } = useAuth();
  const { semesters, activeSemester, setActiveSemester, addSemester, updateSemester, deleteSemester } = useSemesterStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deletingSem = deletingId ? semesters.find((s) => s.id === deletingId) : null;

  if (!isOwner) {
    return (
      <div className="p-4 md:p-6 max-w-4xl">
        <div className="border border-destructive/30 bg-destructive/5 p-6 text-center space-y-2">
          <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm font-bold text-destructive uppercase tracking-wider">Access Denied</p>
          <p className="text-xs text-muted-foreground">Only the owner can manage semesters.</p>
        </div>
      </div>
    );
  }

  const handleSave = (sem: Semester) => {
    const exists = semesters.find((s) => s.id === sem.id);
    if (exists) {
      updateSemester(sem);
      toast({ title: "Updated", description: `${sem.name} has been updated.` });
    } else {
      addSemester(sem);
      toast({ title: "Created", description: `${sem.name} has been added.` });
    }
    setEditing(null);
  };

  const handleDelete = () => {
    if (!deletingId) return;
    const name = deletingSem?.name || "Semester";
    deleteSemester(deletingId);
    setDeletingId(null);
    toast({ title: "Deleted", description: `${name} has been permanently removed.` });
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Owner</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Semesters</h1>
        </div>
        <Button size="sm" className="w-full sm:w-auto" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-3 w-3" /> Add Semester
        </Button>
      </div>

      <div className="space-y-3">
        {semesters.map((sem) => {
          const cfg = statusConfig[sem.status];
          const StatusIcon = cfg.icon;
          const isActive = activeSemester?.id === sem.id;
          return (
            <div key={sem.id} className={cn(
              "border p-4 space-y-2 hover:bg-accent/20 transition-colors",
              isActive ? "border-primary/50 bg-primary/5" : "border-border"
            )}>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm">{sem.name}</h3>
                    <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1", cfg.color)}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {cfg.label}
                    </span>
                    {isActive && (
                      <span className="px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/30 text-[10px] font-bold uppercase tracking-wider">
                        Viewing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Year {sem.year} · {sem.startDate} → {sem.endDate}
                  </p>
                  {sem.examPeriod && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Exams: {sem.examPeriod.start} → {sem.examPeriod.end}
                    </p>
                  )}
                </div>
                {!isActive && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                    setActiveSemester(sem);
                    toast({ title: "Switched", description: `Now viewing ${sem.name}` });
                  }}>
                    <Play className="h-3 w-3" /> View
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(sem); setFormOpen(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingId(sem.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <SemesterFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        initial={editing}
        onSave={handleSave}
      />

      <DeleteSemesterDialog
        open={!!deletingId}
        semesterName={deletingSem?.name || ""}
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};

export default AdminSemesters;
