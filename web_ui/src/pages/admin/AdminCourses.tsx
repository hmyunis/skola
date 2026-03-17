import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
    fetchCourses,
    createCourse,
    updateCourse,
    deleteCourse,
    fetchSemesters,
    type Course,
    type Semester,
} from '@/services/courses';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { BookOpen, Plus, Pencil, Trash2, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/stores/authStore';
import { ShieldAlert } from 'lucide-react';

type CourseFormValues = {
    id?: string;
    name: string;
    code?: string;
    credits?: number;
    instructor?: string;
    semesterId: string;
};

function CourseFormDialog({
    open,
    onOpenChange,
    initial,
    semesters,
    onSave,
    isPending,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    initial?: Course | null;
    semesters: Semester[];
    onSave: (c: CourseFormValues) => void;
    isPending: boolean;
}) {
    const [code, setCode] = useState(initial?.code || '');
    const [name, setName] = useState(initial?.name || '');
    const [credits, setCredits] = useState(String(initial?.credits || 3));
    const [instructor, setInstructor] = useState(initial?.instructor || '');
    const [semesterId, setSemesterId] = useState(initial?.semesterId || semesters[0]?.id || '');

    const defaultSemesterId = semesters[0]?.id || '';

    useEffect(() => {
        setCode(initial?.code || '');
        setName(initial?.name || '');
        setCredits(String(initial?.credits || 3));
        setInstructor(initial?.instructor || '');
        setSemesterId(initial?.semesterId || defaultSemesterId);
    }, [initial, open, defaultSemesterId]);

    const isValid = name.trim() && semesterId;

    const handleSubmit = () => {
        onSave({
            id: initial?.id,
            code: code.trim() || undefined,
            name: name.trim(),
            credits: Number(credits),
            instructor: instructor.trim() || undefined,
            semesterId,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="uppercase tracking-wider text-sm">
                        {initial ? 'Edit Course' : 'Add Course'}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                                Code
                            </label>
                            <Input
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="Course code"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                                Credits
                            </label>
                            <Input
                                type="number"
                                value={credits}
                                onChange={(e) => setCredits(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                            Course Name
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Course name"
                            className="h-9 text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                            Instructor
                        </label>
                        <Input
                            value={instructor}
                            onChange={(e) => setInstructor(e.target.value)}
                            placeholder="Dr. Name"
                            className="h-9 text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                            Semester
                        </label>
                        <Select value={semesterId} onValueChange={setSemesterId}>
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {semesters.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button disabled={!isValid || isPending} onClick={handleSubmit}>
                            {isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : initial ? (
                                <>
                                    <Pencil className="h-3 w-3" /> Save
                                </>
                            ) : (
                                <>
                                    <Plus className="h-3 w-3" /> Add
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const AdminCourses = () => {
    const { isOwner } = useAuth();
    const queryClient = useQueryClient();
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Course | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [semesterFilter, setSemesterFilter] = useState<string>('all');
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Fetch semesters for dropdown
    const { data: semesters = [] } = useQuery({
        queryKey: ['semesters'],
        queryFn: fetchSemesters,
    });

    // Infinite query for courses
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
        queryKey: ['courses', { search, semesterId: semesterFilter }],
        queryFn: ({ pageParam = 1 }) =>
            fetchCourses({
                page: pageParam,
                limit: 20,
                search: search || undefined,
                semesterId: semesterFilter !== 'all' ? semesterFilter : undefined,
            }),
        getNextPageParam: (lastPage) => {
            if (lastPage.meta.page < lastPage.meta.lastPage) {
                return lastPage.meta.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
    });

    // Flatten pages into single array
    const courses = data?.pages.flatMap((page) => page.data) ?? [];
    const totalCount = data?.pages[0]?.meta.total ?? 0;
    const totalCredits = courses.reduce((sum, c) => sum + (c.credits || 0), 0);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: createCourse,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            toast({ title: 'Created', description: 'Course has been added.' });
            setFormOpen(false);
        },
        onError: (err: any) => {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateCourse>[1] }) =>
            updateCourse(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            toast({ title: 'Updated', description: 'Course has been updated.' });
            setFormOpen(false);
            setEditing(null);
        },
        onError: (err: any) => {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: deleteCourse,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            toast({ title: 'Deleted', description: 'Course removed.' });
            setDeletingId(null);
        },
        onError: (err: any) => {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        },
    });

    const handleSave = (c: CourseFormValues) => {
        const { id, ...payload } = c;
        if (id) {
            updateMutation.mutate({ id, data: payload });
        } else {
            createMutation.mutate({
                name: c.name,
                code: c.code,
                credits: c.credits,
                instructor: c.instructor,
                semesterId: c.semesterId,
            });
        }
    };

    // Infinite scroll observer
    const lastElementRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (isFetchingNextPage) return;
            if (observerRef.current) observerRef.current.disconnect();

            observerRef.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasNextPage) {
                    fetchNextPage();
                }
            });

            if (node) observerRef.current.observe(node);
        },
        [hasNextPage, isFetchingNextPage, fetchNextPage],
    );

    if (!isOwner) {
        return (
            <div className="p-8 text-center space-y-3">
                <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
                <h2 className="text-lg font-bold uppercase tracking-wider">Access Denied</h2>
                <p className="text-sm text-muted-foreground">Only the Owner can manage courses.</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-4xl">
            <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
                        Owner
                    </p>
                    <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">
                        Courses
                    </h1>
                </div>
                <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                        setEditing(null);
                        setFormOpen(true);
                    }}
                >
                    <Plus className="h-3 w-3" /> Add Course
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <Card>
                    <CardContent className="p-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            Total Courses
                        </p>
                        <p className="text-2xl font-black tabular-nums mt-1">{totalCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            Total Credits
                        </p>
                        <p className="text-2xl font-black tabular-nums mt-1">{totalCredits}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search courses..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>
                <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                    <SelectTrigger className="h-9 w-44 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Semesters</SelectItem>
                        {semesters.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                                {s.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="border border-border p-3 flex items-center gap-3 animate-pulse"
                            >
                                <div className="p-2 bg-muted w-10 h-10" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 w-24 bg-muted" />
                                    <div className="h-2 w-48 bg-muted" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : courses.length === 0 ? (
                    <div className="border border-dashed border-border p-8 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">
                            No courses found
                        </p>
                    </div>
                ) : (
                    <>
                        {courses.map((c, idx) => (
                            <div
                                key={c.id}
                                ref={idx === courses.length - 1 ? lastElementRef : undefined}
                                className="border border-border p-3 flex items-center gap-3 hover:bg-accent/20 transition-colors"
                            >
                                <div className="p-2 bg-primary/10 border border-primary/30">
                                    <BookOpen className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-bold">{c.code || 'No Code'}</p>
                                        {c.credits && (
                                            <span className="px-1.5 py-0.5 bg-muted border border-border text-[10px] font-bold tabular-nums">
                                                {c.credits} cr
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {c.name}
                                    </p>
                                    {c.instructor && (
                                        <p className="text-[10px] text-muted-foreground">
                                            {c.instructor}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                        setEditing(c);
                                        setFormOpen(true);
                                    }}
                                >
                                    <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    onClick={() => setDeletingId(c.id)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                        {isFetchingNextPage && (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </>
                )}
            </div>

            <CourseFormDialog
                open={formOpen}
                onOpenChange={(o) => {
                    setFormOpen(o);
                    if (!o) setEditing(null);
                }}
                initial={editing}
                semesters={semesters}
                onSave={handleSave}
                isPending={createMutation.isPending || updateMutation.isPending}
            />

            <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Course</AlertDialogTitle>
                        <AlertDialogDescription>
                            This course will be permanently removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deletingId && deleteMutation.mutate(deletingId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default AdminCourses;
