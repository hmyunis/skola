import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCourses } from "@/services/courses";
import {
  RESOURCE_TYPES,
  createLinkResource,
  deleteResource,
  fetchResourceStats,
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
  AudioLines,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Pencil,
  Upload,
  Video,
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
const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "heic",
  "heif",
]);
const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "mov",
  "m4v",
  "ogg",
  "ogv",
  "mkv",
]);
const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "opus",
]);

type ResourcePreviewKind = "image" | "video" | "audio" | "none";

function formatBytes(bytes?: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatResourceDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isResourceEdited(resource: Resource): boolean {
  if (!resource.createdAt || !resource.updatedAt) return false;
  const createdMs = new Date(resource.createdAt).getTime();
  const updatedMs = new Date(resource.updatedAt).getTime();
  if (Number.isNaN(createdMs) || Number.isNaN(updatedMs)) return false;
  return updatedMs - createdMs > 1000;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getResourceExtension(resource: Resource): string {
  const raw = String(resource.fileName || resource.fileUrl || "").trim();
  if (!raw) return "";
  const clean = raw.split("?")[0].split("#")[0];
  const dotIndex = clean.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === clean.length - 1) return "";
  return clean.slice(dotIndex + 1).toLowerCase();
}

function getResourcePreviewKind(resource: Resource): ResourcePreviewKind {
  if (!resource.fileUrl) return "none";
  const ext = getResourceExtension(resource);
  if (!ext) return "none";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  return "none";
}

function ResourceInlinePreview({ resource }: { resource: Resource }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const previewKind = getResourcePreviewKind(resource);

  if (!resource.fileUrl || previewKind === "none") return null;
  if (previewFailed) {
    return (
      <div className="border border-dashed border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        Preview unavailable for this file.
      </div>
    );
  }

  const mediaUrl = `${FILE_BASE}${resource.fileUrl}`;

  if (previewKind === "image") {
    return (
      <>
        <button
          type="button"
          onClick={() => setImageDialogOpen(true)}
          className="group relative block w-full overflow-hidden border border-border bg-muted/20 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Preview image: ${resource.title}`}
        >
          <img
            src={mediaUrl}
            alt={resource.title || "Resource preview"}
            loading="lazy"
            className="w-full max-h-56 object-contain sm:max-h-72"
            onError={() => setPreviewFailed(true)}
          />
          <div className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 border border-border/70 bg-background/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground shadow-sm">
            <ImageIcon className="h-3 w-3" />
            Tap to zoom
          </div>
        </button>
        <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl border-none bg-transparent p-0 shadow-none [&>button]:hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>{resource.title || "Image preview"}</DialogTitle>
            </DialogHeader>
            <div className="overflow-hidden border border-border/50 bg-black/90">
              <img
                src={mediaUrl}
                alt={resource.title || "Resource preview"}
                className="w-full max-h-[calc(100vh-1rem)] object-contain sm:max-h-[calc(100vh-2rem)]"
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (previewKind === "video") {
    return (
      <div className="overflow-hidden border border-border bg-black">
        <div className="flex items-center gap-1.5 border-b border-border/50 bg-background/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Video className="h-3 w-3" />
          Video preview
        </div>
        <div className="aspect-video w-full">
          <video
            controls
            preload="metadata"
            playsInline
            className="h-full w-full bg-black"
            onError={() => setPreviewFailed(true)}
          >
            <source src={mediaUrl} />
          </video>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <AudioLines className="h-3 w-3" />
        Audio preview
      </div>
      <audio
        controls
        preload="metadata"
        className="h-10 w-full"
        onError={() => setPreviewFailed(true)}
      >
        <source src={mediaUrl} />
      </audio>
    </div>
  );
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
  const statsQuery = useQuery({
    queryKey: ["resources", "stats", { courseFilter, typeFilter, search }],
    queryFn: () =>
      fetchResourceStats({
        courseId: courseFilter === "all" ? undefined : courseFilter,
        type: typeFilter === "all" ? undefined : (typeFilter as ResourceType),
        search: search.trim() || undefined,
      }),
  });

  const invalidateResourceQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["resources", "infinite"] });
    queryClient.invalidateQueries({ queryKey: ["resources", "stats"] });
  };

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
      invalidateResourceQueries();
      toast({ title: "Resource created" });
      setFormOpen(false);
    },
    onError: (err: any) => toast({ title: "Create failed", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Resource> }) => updateResource(id, data),
    onSuccess: () => {
      invalidateResourceQueries();
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
      invalidateResourceQueries();
      toast({ title: "Resource updated" });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const voteMutation = useMutation({
    mutationFn: ({ id, vote }: { id: string; vote: "up" | "down" }) => voteResource(id, vote),
    onSuccess: () => invalidateResourceQueries(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => {
      invalidateResourceQueries();
      toast({ title: "Resource deleted" });
      setDeleting(null);
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const resources = resourcesQuery.data?.pages.flatMap((page) => page.data) || [];
  const stats = statsQuery.data;
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
          {[1, 2, 3].map((i) => <div key={i} className="h-24 border border-border bg-card animate-pulse" />)}
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
              className="border border-border bg-card p-3 sm:p-4 hover:bg-card transition-colors space-y-2 overflow-hidden"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-sm break-words line-clamp-2">{resource.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">
                    {(resource.course?.code || resource.course?.name || "Unknown course")} · {(resource.uploader?.name || "Deleted User")} · {formatBytes(resource.fileSize)}
                  </p>
                </div>
                <span className={`self-start px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider ${typeTone[resource.type]}`}>
                  {RESOURCE_TYPES.find((t) => t.value === resource.type)?.label || resource.type}
                </span>
              </div>

              <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{resource.description || "No description"}</p>
              <p className="text-[10px] text-muted-foreground">
                Created {formatResourceDateTime(resource.createdAt)} · Updated {formatResourceDateTime(resource.updatedAt || resource.createdAt)}
                {isResourceEdited(resource) && (
                  <span className="ml-1.5 inline-flex items-center border border-border px-1 py-0 uppercase tracking-wider text-[9px] font-semibold text-primary">
                    Edited
                  </span>
                )}
              </p>
              <ResourceInlinePreview resource={resource} />

              <div className="flex flex-wrap gap-1">
                {resource.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-none text-[10px] max-w-full break-all">{tag}</Badge>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant={resource.userVote === "up" ? "default" : "outline"} className="h-7 text-[11px] shrink-0" onClick={() => voteMutation.mutate({ id: resource.id, vote: "up" })}>
                  <ThumbsUp className="h-3 w-3" /> {resource.upvotes}
                </Button>
                <Button size="sm" variant={resource.userVote === "down" ? "default" : "outline"} className="h-7 text-[11px] shrink-0" onClick={() => voteMutation.mutate({ id: resource.id, vote: "down" })}>
                  <ThumbsDown className="h-3 w-3" /> {resource.downvotes}
                </Button>
                {resource.fileUrl && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" asChild>
                    <a href={`${FILE_BASE}${resource.fileUrl}`} target="_blank" rel="noreferrer">
                      <Download className="h-3 w-3" /> Download
                    </a>
                  </Button>
                )}
                {resource.externalUrl && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" asChild>
                    <a href={resource.externalUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3" /> Open Link
                    </a>
                  </Button>
                )}
                {canReport(resource) && (
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] shrink-0" onClick={() => setReporting(resource)}>
                    Report
                  </Button>
                )}
                {canEdit(resource) && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" onClick={() => { setEditing(resource); setFormOpen(true); }}>
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                )}
                {canDelete(resource) && (
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive hover:text-destructive shrink-0" onClick={() => setDeleting(resource)}>
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
        contentAuthor={reporting?.uploader?.name || "Deleted User"}
      />
    </div>
  );
};

export default Resources;
