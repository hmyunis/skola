import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCourses } from "@/services/courses";
import {
  RESOURCE_TYPES,
  createLinkResource,
  deleteResource,
  fetchResources,
  updateResource,
  updateResourceFile,
  uploadResourceFile,
  voteResource,
  type Resource,
  type ResourceType,
} from "@/services/resources";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useSemesterStore } from "@/stores/semesterStore";
import { useAuth } from "@/stores/authStore";
import { ReportDialog } from "@/components/ReportDialog";
import {
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Pencil,
  Upload,
  Link as LinkIcon,
  FolderOpen,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const FILE_BASE = API_BASE.replace(/\/api\/?$/, "");
const typeTone: Record<ResourceType, string> = {
  note: "bg-primary/10 text-primary border-primary/30",
  slide: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  past_paper: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  ebook: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  other: "bg-muted text-muted-foreground border-border",
};

function formatBytes(bytes?: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function ResourceDialog({
  open,
  onOpenChange,
  initial,
  courseOptions,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Resource | null;
  courseOptions: Array<{ id: string; label: string }>;
  onSubmit: (payload: {
    title: string;
    description: string;
    courseId: string;
    type: ResourceType;
    tags: string[];
    file?: File | null;
    externalUrl?: string;
  }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [courseId, setCourseId] = useState(initial?.courseId || "");
  const [type, setType] = useState<ResourceType>(initial?.type || "note");
  const [tags, setTags] = useState((initial?.tags || []).join(", "));
  const [mode, setMode] = useState<"file" | "link">(initial?.externalUrl ? "link" : "file");
  const [externalUrl, setExternalUrl] = useState(initial?.externalUrl || "");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setTitle(initial?.title || "");
    setDescription(initial?.description || "");
    setCourseId(initial?.courseId || "");
    setType(initial?.type || "note");
    setTags((initial?.tags || []).join(", "));
    setMode(initial?.externalUrl ? "link" : "file");
    setExternalUrl(initial?.externalUrl || "");
    setFile(null);
  }, [initial, open]);

  const normalizedUrl = externalUrl.trim();
  const urlValid = mode === "link" ? isValidHttpUrl(normalizedUrl) : true;
  const valid = title.trim() && description.trim() && courseId && (mode === "link" ? normalizedUrl && urlValid : file || initial?.fileUrl);

  const submit = () => {
    if (!valid) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      courseId,
      type,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      file,
      externalUrl: mode === "link" ? externalUrl.trim() : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Resource" : "Add Resource"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {courseOptions.map((course) => (
                  <SelectItem key={course.id} value={course.id}>{course.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as ResourceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated)" />
          <div className="flex gap-2">
            <Button type="button" variant={mode === "file" ? "default" : "outline"} onClick={() => setMode("file")}>
              <Upload className="h-3.5 w-3.5" /> File
            </Button>
            <Button type="button" variant={mode === "link" ? "default" : "outline"} onClick={() => setMode("link")}>
              <LinkIcon className="h-3.5 w-3.5" /> Link
            </Button>
          </div>
          {mode === "file" ? (
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          ) : (
            <div className="space-y-1">
              <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." />
              {normalizedUrl && !urlValid && (
                <p className="text-[11px] text-destructive">Enter a valid http/https URL.</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!valid || isPending} onClick={submit}>
              {initial ? <><Pencil className="h-3.5 w-3.5" /> Save</> : <><Plus className="h-3.5 w-3.5" /> Create</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Resources = () => {
  const queryClient = useQueryClient();
  const semId = useSemesterStore((s) => s.activeSemester?.id);
  const { user, isAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [deleting, setDeleting] = useState<Resource | null>(null);
  const [reporting, setReporting] = useState<Resource | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const coursesQuery = useQuery({
    queryKey: ["courses", "resources", semId],
    queryFn: () => fetchCourses({ page: 1, limit: 100, semesterId: semId || undefined }),
  });

  const courseOptions = useMemo(
    () =>
      (coursesQuery.data?.data || []).map((course) => ({
        id: course.id,
        label: course.code ? `${course.code} - ${course.name}` : course.name,
      })),
    [coursesQuery.data?.data],
  );

  const resourcesQuery = useInfiniteQuery({
    queryKey: ["resources", "infinite", { courseFilter, typeFilter, search }],
    queryFn: ({ pageParam = 1 }) =>
      fetchResources({
        page: pageParam,
        limit: 20,
        courseId: courseFilter === "all" ? undefined : courseFilter,
        type: typeFilter === "all" ? undefined : (typeFilter as ResourceType),
        search: search.trim() || undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.lastPage ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      description: string;
      courseId: string;
      type: ResourceType;
      tags: string[];
      file?: File | null;
      externalUrl?: string;
    }) => {
      if (payload.file) {
        return uploadResourceFile({
          file: payload.file,
          courseId: payload.courseId,
          title: payload.title,
          description: payload.description,
          type: payload.type,
          tags: payload.tags,
        });
      }
      if (!payload.externalUrl) {
        throw new Error("External URL is required for link resources");
      }
      return createLinkResource({
        courseId: payload.courseId,
        title: payload.title,
        description: payload.description,
        externalUrl: payload.externalUrl,
        type: payload.type,
        tags: payload.tags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "infinite"] });
      toast({ title: "Resource created" });
      setFormOpen(false);
    },
    onError: (err: any) => toast({ title: "Create failed", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Resource> }) => updateResource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "infinite"] });
      toast({ title: "Resource updated" });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const updateFileMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        file: File;
        title: string;
        description?: string;
        courseId: string;
        type: ResourceType;
        tags?: string[];
      };
    }) => updateResourceFile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "infinite"] });
      toast({ title: "Resource updated" });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const voteMutation = useMutation({
    mutationFn: ({ id, vote }: { id: string; vote: "up" | "down" }) => voteResource(id, vote),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resources", "infinite"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "infinite"] });
      toast({ title: "Resource deleted" });
      setDeleting(null);
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const resources = resourcesQuery.data?.pages.flatMap((page) => page.data) || [];
  const stats = resourcesQuery.data?.pages[0]?.stats;
  const totalCount = resourcesQuery.data?.pages[0]?.meta.total || 0;

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (resourcesQuery.isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && resourcesQuery.hasNextPage) {
          resourcesQuery.fetchNextPage();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [resourcesQuery],
  );

  const canEdit = (resource: Resource) => {
    if (!user) return false;
    return resource.uploader?.id === user.id;
  };

  const canDelete = (resource: Resource) => {
    if (!user) return false;
    return Boolean(isAdmin || resource.uploader?.id === user.id);
  };

  const canReport = (resource: Resource) => {
    if (!user) return false;
    return resource.uploader?.id !== user.id;
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">File Hub</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Resources</h1>
        </div>
        <Button size="sm" className="uppercase tracking-wider text-[11px] font-bold" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Resource
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="relative md:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search resources..." className="pl-9" />
        </div>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger><SelectValue placeholder="All courses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {courseOptions.map((course) => (
              <SelectItem key={course.id} value={course.id}>{course.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {RESOURCE_TYPES.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-none"><CardContent className="p-3 sm:p-4"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Files</p><p className="text-2xl font-black tabular-nums mt-1">{stats?.totalResources ?? 0}</p></CardContent></Card>
        <Card className="rounded-none"><CardContent className="p-3 sm:p-4"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">File Types</p><p className="text-2xl font-black tabular-nums mt-1">{stats?.totalTypes ?? 0}</p></CardContent></Card>
        <Card className="rounded-none"><CardContent className="p-3 sm:p-4"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Upvotes</p><p className="text-2xl font-black tabular-nums mt-1">{stats?.totalUpvotes ?? 0}</p></CardContent></Card>
        <Card className="rounded-none"><CardContent className="p-3 sm:p-4"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Downvotes</p><p className="text-2xl font-black tabular-nums mt-1">{stats?.totalDownvotes ?? 0}</p></CardContent></Card>
      </div>

      {resourcesQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 border border-border animate-pulse bg-muted/30" />)}
        </div>
      ) : resources.length === 0 ? (
        <div className="border border-dashed border-border p-10 text-center space-y-2">
          <FolderOpen className="h-7 w-7 mx-auto text-muted-foreground" />
          <p className="text-sm uppercase tracking-wider text-muted-foreground">No resources found</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{totalCount} result{totalCount === 1 ? "" : "s"}</p>
          {resources.map((resource, idx) => (
            <div
              key={resource.id}
              ref={idx === resources.length - 1 ? lastElementRef : undefined}
              className="border border-border p-3 sm:p-4 hover:bg-accent/20 transition-colors space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{resource.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(resource.course?.code || resource.course?.name || "Unknown course")} · {(resource.uploader?.name || "Unknown uploader")} · {formatBytes(resource.fileSize)}
                  </p>
                </div>
                <span className={`px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider ${typeTone[resource.type]}`}>
                  {RESOURCE_TYPES.find((t) => t.value === resource.type)?.label || resource.type}
                </span>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">{resource.description || "No description"}</p>

              <div className="flex flex-wrap gap-1">
                {resource.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-none text-[10px]">{tag}</Badge>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant={resource.userVote === "up" ? "default" : "outline"} className="h-7 text-[11px]" onClick={() => voteMutation.mutate({ id: resource.id, vote: "up" })}>
                  <ThumbsUp className="h-3 w-3" /> {resource.upvotes}
                </Button>
                <Button size="sm" variant={resource.userVote === "down" ? "default" : "outline"} className="h-7 text-[11px]" onClick={() => voteMutation.mutate({ id: resource.id, vote: "down" })}>
                  <ThumbsDown className="h-3 w-3" /> {resource.downvotes}
                </Button>
                {resource.fileUrl && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" asChild>
                    <a href={`${FILE_BASE}${resource.fileUrl}`} target="_blank" rel="noreferrer">
                      <Download className="h-3 w-3" /> Download
                    </a>
                  </Button>
                )}
                {resource.externalUrl && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" asChild>
                    <a href={resource.externalUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3" /> Open Link
                    </a>
                  </Button>
                )}
                {canReport(resource) && (
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setReporting(resource)}>
                    Report
                  </Button>
                )}
                {canEdit(resource) && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setEditing(resource); setFormOpen(true); }}>
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                )}
                {canDelete(resource) && (
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive hover:text-destructive" onClick={() => setDeleting(resource)}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                )}
                </div>
            </div>
          ))}
          {resourcesQuery.isFetchingNextPage && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}

      <ResourceDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        initial={editing}
        courseOptions={courseOptions}
        isPending={createMutation.isPending || updateMutation.isPending || updateFileMutation.isPending}
        onSubmit={(payload) => {
          if (editing) {
            if (payload.file) {
              updateFileMutation.mutate({
                id: editing.id,
                data: {
                  file: payload.file,
                  title: payload.title,
                  description: payload.description,
                  courseId: payload.courseId,
                  type: payload.type,
                  tags: payload.tags,
                },
              });
              return;
            }
            updateMutation.mutate({
              id: editing.id,
              data: {
                title: payload.title,
                description: payload.description,
                courseId: payload.courseId,
                type: payload.type,
                tags: payload.tags,
                externalUrl: payload.externalUrl || undefined,
              },
            });
            return;
          }
          createMutation.mutate(payload);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleting?.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleting && deleteMutation.mutate(deleting.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportDialog
        open={!!reporting}
        onOpenChange={(open) => !open && setReporting(null)}
        contentType="resource"
        contentId={reporting?.id || ""}
        contentPreview={`${reporting?.title || ""} ${reporting?.description || ""}`.trim()}
        contentAuthor={reporting?.uploader?.name || "Unknown"}
      />
    </div>
  );
};

export default Resources;
