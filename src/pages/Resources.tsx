import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchResources,
  RESOURCE_TYPES,
  RESOURCE_CATEGORIES,
  type Resource,
  type ResourceType,
  type ResourceCategory,
} from "@/services/resources";
import { COURSES } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FolderOpen,
  Search,
  Filter,
  Star,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Presentation,
  StickyNote,
  Video,
  Code2,
  ExternalLink,
  Calendar,
  User,
  HardDrive,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Type icon map ───
const typeIcons: Record<ResourceType, typeof FileText> = {
  pdf: FileText,
  slides: Presentation,
  notes: StickyNote,
  video: Video,
  code: Code2,
  link: ExternalLink,
};

const typeColors: Record<ResourceType, string> = {
  pdf: "bg-destructive/10 text-destructive border-destructive/30",
  slides: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  notes: "bg-primary/10 text-primary border-primary/30",
  video: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  code: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  link: "bg-sky-500/10 text-sky-600 border-sky-500/30",
};

const categoryColors: Record<ResourceCategory, string> = {
  lecture: "bg-primary/10 text-primary border-primary/30",
  lab: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  reference: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  "exam-prep": "bg-amber-500/10 text-amber-600 border-amber-500/30",
  project: "bg-violet-500/10 text-violet-600 border-violet-500/30",
};

// ─── Star Rating Component ───
function StarRating({
  rating,
  totalRatings,
  userRating,
  onRate,
  size = "sm",
}: {
  rating: number;
  totalRatings: number;
  userRating?: number;
  onRate?: (stars: number) => void;
  size?: "sm" | "md";
}) {
  const [hoverStar, setHoverStar] = useState(0);
  const iconSize = size === "md" ? "h-4 w-4" : "h-3 w-3";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHoverStar(0)}>
        {[1, 2, 3, 4, 5].map((s) => {
          const filled = hoverStar ? s <= hoverStar : s <= Math.round(userRating || rating);
          return (
            <button
              key={s}
              onMouseEnter={() => onRate && setHoverStar(s)}
              onClick={() => onRate?.(s)}
              className={cn(
                "transition-colors",
                onRate ? "cursor-pointer" : "cursor-default"
              )}
            >
              <Star
                className={cn(
                  iconSize,
                  filled
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                )}
              />
            </button>
          );
        })}
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {rating.toFixed(1)} ({totalRatings})
      </span>
    </div>
  );
}

// ─── Vote Buttons ───
function VoteButtons({
  upvotes,
  downvotes,
  userVote,
  onVote,
}: {
  upvotes: number;
  downvotes: number;
  userVote?: "up" | "down";
  onVote: (dir: "up" | "down") => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); onVote("up"); }}
        className={cn(
          "flex items-center gap-1 px-2 py-1 border text-[10px] font-bold uppercase tracking-wider transition-all",
          userVote === "up"
            ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-600"
            : "border-border text-muted-foreground hover:bg-accent"
        )}
      >
        <ThumbsUp className="h-3 w-3" />
        <span className="tabular-nums">{upvotes + (userVote === "up" ? 1 : 0)}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onVote("down"); }}
        className={cn(
          "flex items-center gap-1 px-2 py-1 border text-[10px] font-bold uppercase tracking-wider transition-all",
          userVote === "down"
            ? "bg-destructive/15 border-destructive/50 text-destructive"
            : "border-border text-muted-foreground hover:bg-accent"
        )}
      >
        <ThumbsDown className="h-3 w-3" />
        <span className="tabular-nums">{downvotes + (userVote === "down" ? 1 : 0)}</span>
      </button>
    </div>
  );
}

// ─── Resource Detail Dialog ───
function ResourceDetailDialog({
  resource,
  userRating,
  userVote,
  onRate,
  onVote,
  onClose,
}: {
  resource: Resource | null;
  userRating?: number;
  userVote?: "up" | "down";
  onRate: (id: string, stars: number) => void;
  onVote: (id: string, dir: "up" | "down") => void;
  onClose: () => void;
}) {
  if (!resource) return null;

  const TypeIcon = typeIcons[resource.type];
  const courseName = COURSES.find((c) => c.code === resource.course)?.name || resource.course;
  const catLabel = RESOURCE_CATEGORIES.find((c) => c.value === resource.category)?.label || resource.category;
  const typeLabel = RESOURCE_TYPES.find((t) => t.value === resource.type)?.label || resource.type;

  return (
    <Dialog open={!!resource} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">Resource Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Title + icon */}
          <div className="flex items-start gap-3">
            <div className={cn("p-2.5 border", typeColors[resource.type])}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold leading-tight">{resource.title}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{courseName}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">{resource.description}</p>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>{resource.uploadedBy}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{new Date(resource.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5 shrink-0" />
              <span>{resource.size}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", typeColors[resource.type])}>
                <TypeIcon className="h-2.5 w-2.5" />
                {typeLabel}
              </span>
            </div>
          </div>

          {/* Category + Tags */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider", categoryColors[resource.category])}>
                {catLabel}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {resource.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted text-muted-foreground border border-border text-[10px] uppercase tracking-wider"
                >
                  <Tag className="h-2 w-2" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div className="border border-border p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Your Rating</p>
            <StarRating
              rating={resource.rating}
              totalRatings={resource.totalRatings}
              userRating={userRating}
              onRate={(stars) => onRate(resource.id, stars)}
              size="md"
            />
          </div>

          {/* Votes */}
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Helpful?</p>
            <VoteButtons
              upvotes={resource.upvotes}
              downvotes={resource.downvotes}
              userVote={userVote}
              onVote={(dir) => onVote(resource.id, dir)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Resource Card ───
function ResourceCard({
  resource,
  userVote,
  onVote,
  onClick,
}: {
  resource: Resource;
  userVote?: "up" | "down";
  onVote: (id: string, dir: "up" | "down") => void;
  onClick: () => void;
}) {
  const TypeIcon = typeIcons[resource.type];
  const catLabel = RESOURCE_CATEGORIES.find((c) => c.value === resource.category)?.label || resource.category;

  return (
    <div
      className="border border-border p-3 sm:p-4 hover:bg-accent/30 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={cn("p-2 border shrink-0", typeColors[resource.type])}>
          <TypeIcon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div>
            <p className="font-bold text-sm truncate">{resource.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {resource.course} · {resource.uploadedBy} · {resource.size}
            </p>
          </div>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", typeColors[resource.type])}>
              {RESOURCE_TYPES.find((t) => t.value === resource.type)?.label}
            </span>
            <span className={cn("px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider", categoryColors[resource.category])}>
              {catLabel}
            </span>
          </div>

          {/* Rating + votes row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <StarRating rating={resource.rating} totalRatings={resource.totalRatings} />
            <VoteButtons
              upvotes={resource.upvotes}
              downvotes={resource.downvotes}
              userVote={userVote}
              onVote={(dir) => onVote(resource.id, dir)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
const Resources = () => {
  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: fetchResources,
  });

  const [search, setSearch] = useState("");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("rating");
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [detailResource, setDetailResource] = useState<Resource | null>(null);

  const handleVote = (id: string, dir: "up" | "down") => {
    setVotes((prev) => ({
      ...prev,
      [id]: prev[id] === dir ? undefined! : dir,
    }));
  };

  const handleRate = (id: string, stars: number) => {
    setRatings((prev) => ({ ...prev, [id]: stars }));
  };

  const coursesInData = useMemo(() => {
    if (!resources) return [];
    return [...new Set(resources.map((r) => r.course))].sort();
  }, [resources]);

  const filtered = useMemo(() => {
    if (!resources) return [];
    let result = resources.filter((r) => {
      if (filterCourse !== "all" && r.course !== filterCourse) return false;
      if (filterType !== "all" && r.type !== filterType) return false;
      if (filterCategory !== "all" && r.category !== filterCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags.some((t) => t.includes(q)) ||
          r.course.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Sort
    if (sortBy === "rating") result.sort((a, b) => b.rating - a.rating);
    else if (sortBy === "upvotes") result.sort((a, b) => b.upvotes - a.upvotes);
    else if (sortBy === "newest") result.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    else if (sortBy === "name") result.sort((a, b) => a.title.localeCompare(b.title));

    return result;
  }, [resources, filterCourse, filterType, filterCategory, search, sortBy]);

  // Stats
  const stats = useMemo(() => {
    if (!resources) return { total: 0, types: 0, courses: 0, avgRating: 0 };
    return {
      total: resources.length,
      types: new Set(resources.map((r) => r.type)).size,
      courses: new Set(resources.map((r) => r.course)).size,
      avgRating: +(resources.reduce((s, r) => s + r.rating, 0) / resources.length).toFixed(1),
    };
  }, [resources]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">File Hub</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">Resources</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Files</p>
            <p className="text-2xl font-black tabular-nums mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">File Types</p>
            <p className="text-2xl font-black tabular-nums mt-1">{stats.types}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Courses</p>
            <p className="text-2xl font-black tabular-nums mt-1">{stats.courses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-widest text-primary">Avg Rating</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <p className="text-2xl font-black tabular-nums">{stats.avgRating}</p>
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files, tags, courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-widest font-bold">Filters</span>
          </div>

          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {coursesInData.map((code) => (
                <SelectItem key={code} value={code}>{code}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {RESOURCE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {RESOURCE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Top Rated</SelectItem>
              <SelectItem value="upvotes">Most Upvoted</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
            </SelectContent>
          </Select>

          {(filterCourse !== "all" || filterType !== "all" || filterCategory !== "all" || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setFilterCourse("all");
                setFilterType("all");
                setFilterCategory("all");
                setSearch("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {filtered.length} resource{filtered.length !== 1 ? "s" : ""}
        {search && ` matching "${search}"`}
      </p>

      {/* Resource list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 p-12 flex flex-col items-center gap-2">
          <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm uppercase tracking-wider text-muted-foreground">No resources found</p>
          <p className="text-xs text-muted-foreground/60">Try adjusting filters or search terms</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              userVote={votes[resource.id]}
              onVote={handleVote}
              onClick={() => setDetailResource(resource)}
            />
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <ResourceDetailDialog
        resource={detailResource}
        userRating={detailResource ? ratings[detailResource.id] : undefined}
        userVote={detailResource ? votes[detailResource.id] : undefined}
        onRate={handleRate}
        onVote={handleVote}
        onClose={() => setDetailResource(null)}
      />
    </div>
  );
};

export default Resources;
