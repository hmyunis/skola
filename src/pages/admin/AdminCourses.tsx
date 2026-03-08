import { useState } from "react";
import {
  loadCourses,
  saveCourses,
  loadSemesters,
  type AdminCourse,
} from "@/services/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

function CourseFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: AdminCourse | null;
  onSave: (c: AdminCourse) => void;
}) {
  const semesters = loadSemesters();
  const [code, setCode] = useState(initial?.code || "");
  const [name, setName] = useState(initial?.name || "");
  const [credits, setCredits] = useState(String(initial?.credits || 3));
  const [instructor, setInstructor] = useState(initial?.instructor || "");
  const [department, setDepartment] = useState(initial?.department || "Computer Science");
  const [semesterId, setSemesterId] = useState(initial?.semesterId || semesters[0]?.id || "");
  

  const isValid = code.trim() && name.trim() && instructor.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">
            {initial ? "Edit Course" : "Add Course"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Code</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS301" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Credits</label>
              <Input type="number" value={credits} onChange={(e) => setCredits(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Course Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Data Structures & Algorithms" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Instructor</label>
            <Input value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="Dr. Name" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Department</label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Semester</label>
            <Select value={semesterId} onValueChange={setSemesterId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {semesters.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!isValid} onClick={() => {
              onSave({
                id: initial?.id || `c-${Date.now()}`,
                code: code.trim(),
                name: name.trim(),
                credits: Number(credits),
                instructor: instructor.trim(),
                department: department.trim(),
                semesterId,
                enrolled: initial?.enrolled || 0,
                maxCapacity: Number(maxCapacity),
              });
              onOpenChange(false);
            }}>
              {initial ? <><Pencil className="h-3 w-3" /> Save</> : <><Plus className="h-3 w-3" /> Add</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const AdminCourses = () => {
  const [courses, setCourses] = useState<AdminCourse[]>(loadCourses);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCourse | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const save = (updated: AdminCourse[]) => {
    setCourses(updated);
    saveCourses(updated);
  };

  const handleSave = (c: AdminCourse) => {
    const exists = courses.find((x) => x.id === c.id);
    if (exists) {
      save(courses.map((x) => (x.id === c.id ? c : x)));
      toast({ title: "Updated", description: `${c.code} has been updated.` });
    } else {
      save([c, ...courses]);
      toast({ title: "Created", description: `${c.code} has been added.` });
    }
    setEditing(null);
  };

  const handleDelete = () => {
    if (!deletingId) return;
    save(courses.filter((c) => c.id !== deletingId));
    setDeletingId(null);
    toast({ title: "Deleted", description: "Course removed." });
  };

  const filtered = courses.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <div className="border-b border-border pb-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Admin</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Courses</h1>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-3 w-3" /> Add Course
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-2xl font-black tabular-nums mt-1">{courses.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Departments</p>
          <p className="text-2xl font-black tabular-nums mt-1">{new Set(courses.map((c) => c.department)).size}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Enrolled</p>
          <p className="text-2xl font-black tabular-nums mt-1">{courses.reduce((s, c) => s + c.enrolled, 0)}</p>
        </CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search courses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      <div className="space-y-2">
        {filtered.map((c) => (
          <div key={c.id} className="border border-border p-3 flex items-center gap-3 hover:bg-accent/20 transition-colors">
            <div className="p-2 bg-primary/10 border border-primary/30">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold">{c.code}</p>
                <span className="px-1.5 py-0.5 bg-muted border border-border text-[10px] font-bold tabular-nums">{c.credits} cr</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.name}</p>
              <p className="text-[10px] text-muted-foreground">{c.instructor} · {c.department}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span className="tabular-nums">{c.enrolled}/{c.maxCapacity}</span>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(c); setFormOpen(true); }}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeletingId(c.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <CourseFormDialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} initial={editing} onSave={handleSave} />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Course</AlertDialogTitle><AlertDialogDescription>This course will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCourses;
