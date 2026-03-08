import { useState } from "react";
import {
  loadSemesters,
  saveSemesters,
  type Semester,
} from "@/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/DatePicker";
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
  const [term, setTerm] = useState(String(initial?.term || 1));
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
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Year</label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Term</label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Term 1</SelectItem>
                  <SelectItem value="2">Term 2</SelectItem>
                  <SelectItem value="3">Summer</SelectItem>
                </SelectContent>
              </Select>
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              disabled={!isValid}
              onClick={() => {
                onSave({
                  id: initial?.id || `sem-${Date.now()}`,
                  name: name.trim(),
                  year: Number(year),
                  term: Number(term),
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

const AdminSemesters = () => {
  const [semesters, setSemesters] = useState<Semester[]>(loadSemesters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const save = (updated: Semester[]) => {
    setSemesters(updated);
    saveSemesters(updated);
  };

  const handleSave = (sem: Semester) => {
    const exists = semesters.find((s) => s.id === sem.id);
    if (exists) {
      save(semesters.map((s) => (s.id === sem.id ? sem : s)));
      toast({ title: "Updated", description: `${sem.name} has been updated.` });
    } else {
      save([sem, ...semesters]);
      toast({ title: "Created", description: `${sem.name} has been added.` });
    }
    setEditing(null);
  };

  const handleDelete = () => {
    if (!deletingId) return;
    save(semesters.filter((s) => s.id !== deletingId));
    setDeletingId(null);
    toast({ title: "Deleted", description: "Semester removed." });
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div className="border-b border-border pb-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Admin</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Semesters</h1>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-3 w-3" /> Add Semester
        </Button>
      </div>

      <div className="space-y-3">
        {semesters.map((sem) => {
          const cfg = statusConfig[sem.status];
          const StatusIcon = cfg.icon;
          return (
            <div key={sem.id} className="border border-border p-4 space-y-2 hover:bg-accent/20 transition-colors">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm">{sem.name}</h3>
                    <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1", cfg.color)}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Year {sem.year} · Term {sem.term} · {sem.startDate} → {sem.endDate}
                  </p>
                  {sem.examPeriod && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Exams: {sem.examPeriod.start} → {sem.examPeriod.end}
                    </p>
                  )}
                </div>
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

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Semester</AlertDialogTitle>
            <AlertDialogDescription>This semester and its configuration will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSemesters;
