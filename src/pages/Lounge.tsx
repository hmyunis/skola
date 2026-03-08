import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchLoungePosts,
  fetchPostReplies,
  POST_TAGS,
  REACTIONS,
  type LoungePost,
  type LoungeReply,
  type PostTag,
  type AcademicReaction,
} from "@/services/lounge";
import { COURSES } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Send,
  Filter,
  Search,
  MessageCircle,
  Clock,
  TrendingUp,
  User,
  UserCheck,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const MOCK_USER_NAME = "Arjun Patel";

// ─── Time ago helper ───
function timeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Reaction Button ───
function ReactionButton({
  emoji,
  label,
  count,
  active,
  onClick,
}: {
  emoji: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={label}
      className={cn(
        "flex items-center gap-1 px-2 py-1 border text-xs tabular-nums transition-all",
        active
          ? "bg-primary/10 border-primary/40 text-primary font-bold"
          : "border-border text-muted-foreground hover:bg-accent"
      )}
    >
      <span>{emoji}</span>
      <span>{count + (active ? 1 : 0)}</span>
    </button>
  );
}

// ─── Reply Item ───
function ReplyItem({ reply }: { reply: LoungeReply }) {
  return (
    <div className="flex gap-2 py-2">
      <CornerDownRight className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <User className="h-2.5 w-2.5" />
          <span className="font-medium">{reply.anonymous_id}</span>
          <span className="opacity-50">·</span>
          <span>{timeAgo(reply.timestamp)}</span>
        </div>
        <p className="text-xs leading-relaxed">{reply.content}</p>
      </div>
    </div>
  );
}

// ─── Replies Section ───
function RepliesSection({
  postId,
  replyCount,
  localReplies,
  onAddReply,
}: {
  postId: string;
  replyCount: number;
  localReplies: LoungeReply[];
  onAddReply: (postId: string, content: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");

  const { data: fetchedReplies, isLoading } = useQuery({
    queryKey: ["loungeReplies", postId],
    queryFn: () => fetchPostReplies(postId),
    enabled: expanded,
  });

  const allReplies = useMemo(() => {
    const fetched = fetchedReplies || [];
    return [...fetched, ...localReplies];
  }, [fetchedReplies, localReplies]);

  const handleSubmit = () => {
    if (!replyText.trim()) return;
    onAddReply(postId, replyText.trim());
    setReplyText("");
  };

  return (
    <div className="space-y-2">
      {/* Toggle button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <MessageCircle className="h-3 w-3" />
        <span className="tabular-nums font-medium">
          {replyCount + localReplies.length} {replyCount + localReplies.length === 1 ? "reply" : "replies"}
        </span>
      </button>

      {expanded && (
        <div className="ml-2 border-l-2 border-border pl-3 space-y-1">
          {isLoading ? (
            <div className="py-2 space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-8 bg-muted animate-pulse" />
              ))}
            </div>
          ) : allReplies.length === 0 ? (
            <p className="text-[10px] text-muted-foreground py-2">No replies yet. Be the first!</p>
          ) : (
            allReplies.map((r) => <ReplyItem key={r.id} reply={r} />)
          )}

          {/* Reply input */}
          <div className="flex items-center gap-2 pt-1">
            <Input
              placeholder="Write a reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="h-7 text-xs flex-1"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={handleSubmit}
              disabled={!replyText.trim()}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Post Card ───
function PostCard({
  post,
  userReactions,
  localReplies,
  onReact,
  onAddReply,
}: {
  post: LoungePost;
  userReactions: Set<AcademicReaction>;
  localReplies: LoungeReply[];
  onReact: (postId: string, reaction: AcademicReaction) => void;
  onAddReply: (postId: string, content: string) => void;
}) {
  const tagConfig = POST_TAGS.find((t) => t.value === post.tag);
  const courseName = post.course
    ? COURSES.find((c) => c.code === post.course)?.name
    : null;

  const sortedReactions = REACTIONS.map((r) => ({
    ...r,
    count: post.reactions[r.emoji] || 0,
  })).sort((a, b) => b.count - a.count);

  return (
    <div className="border border-border p-4 space-y-3 hover:bg-accent/20 transition-colors">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        {tagConfig && (
          <span
            className={cn(
              "px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider",
              tagConfig.color
            )}
          >
            {tagConfig.label}
          </span>
        )}
        {post.course && (
          <span className="px-1.5 py-0.5 border border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {post.course}
          </span>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {post.isAnonymous ? (
            <User className="h-3 w-3" />
          ) : (
            <UserCheck className="h-3 w-3 text-primary" />
          )}
          <span className={cn("font-medium", !post.isAnonymous && "text-foreground")}>
            {post.isAnonymous ? post.anonymous_id : post.displayName}
          </span>
          <span className="opacity-50">·</span>
          <Clock className="h-3 w-3" />
          <span>{timeAgo(post.timestamp)}</span>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed">{post.content}</p>
      {courseName && (
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
          re: {courseName}
        </p>
      )}

      {/* Reactions row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {sortedReactions.map((r) => (
          <ReactionButton
            key={r.emoji}
            emoji={r.emoji}
            label={r.label}
            count={r.count}
            active={userReactions.has(r.emoji)}
            onClick={() => onReact(post.id, r.emoji)}
          />
        ))}
      </div>

      {/* Replies section */}
      <RepliesSection
        postId={post.id}
        replyCount={post.replies}
        localReplies={localReplies}
        onAddReply={onAddReply}
      />
    </div>
  );
}

// ─── Compose Box ───
function ComposeBox({ onPost }: { onPost: (content: string, tag: PostTag, course?: string) => void }) {
  const [content, setContent] = useState("");
  const [tag, setTag] = useState<PostTag>("discussion");
  const [course, setCourse] = useState<string>("none");
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = () => {
    if (!content.trim()) return;
    onPost(content.trim(), tag, course === "none" ? undefined : course);
    setContent("");
    setTag("discussion");
    setCourse("none");
    setExpanded(false);
  };

  const charCount = content.length;
  const maxChars = 500;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-7 w-7 bg-muted border border-border flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Posting Anonymously
          </span>
        </div>

        <Textarea
          placeholder="What's on your mind? Rant, ask, share..."
          value={content}
          onChange={(e) => {
            setContent(e.target.value.slice(0, maxChars));
            if (!expanded) setExpanded(true);
          }}
          onFocus={() => setExpanded(true)}
          className="min-h-[60px] text-sm resize-none"
          rows={expanded ? 3 : 2}
        />

        {expanded && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tag} onValueChange={(v) => setTag(v as PostTag)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_TAGS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={course} onValueChange={setCourse}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Course (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Course</SelectItem>
                {COURSES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <span
              className={cn(
                "text-[10px] tabular-nums",
                charCount > maxChars * 0.9 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {charCount}/{maxChars}
            </span>

            <Button size="sm" onClick={handleSubmit} disabled={!content.trim()}>
              <Send className="h-3 w-3" />
              Post
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───
const Lounge = () => {
  const { data: fetchedPosts, isLoading } = useQuery({
    queryKey: ["loungePosts"],
    queryFn: fetchLoungePosts,
  });

  const [localPosts, setLocalPosts] = useState<LoungePost[]>([]);
  const [localReplies, setLocalReplies] = useState<Record<string, LoungeReply[]>>({});
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [userReactions, setUserReactions] = useState<Record<string, Set<AcademicReaction>>>({});

  const allPosts = useMemo(() => {
    return [...localPosts, ...(fetchedPosts || [])];
  }, [fetchedPosts, localPosts]);

  const handleReact = (postId: string, reaction: AcademicReaction) => {
    setUserReactions((prev) => {
      const current = new Set(prev[postId] || []);
      if (current.has(reaction)) {
        current.delete(reaction);
      } else {
        current.add(reaction);
      }
      return { ...prev, [postId]: current };
    });
  };

  const handlePost = (content: string, tag: PostTag, course?: string) => {
    const newPost: LoungePost = {
      id: `local-${Date.now()}`,
      content,
      tag,
      course,
      timestamp: new Date().toISOString(),
      reactions: { "🧠": 0, "💀": 0, "🔥": 0, "📚": 0, "😭": 0, "🤝": 0 },
      replies: 0,
      anonymous_id: `Anon#${Math.floor(1000 + Math.random() * 9000)}`,
    };
    setLocalPosts((prev) => [newPost, ...prev]);
    toast({ title: "Posted!", description: "Your anonymous post is live." });
  };

  const handleAddReply = (postId: string, content: string) => {
    const newReply: LoungeReply = {
      id: `lr-${Date.now()}`,
      content,
      timestamp: new Date().toISOString(),
      anonymous_id: `Anon#${Math.floor(1000 + Math.random() * 9000)}`,
    };
    setLocalReplies((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newReply],
    }));
    toast({ title: "Replied!", description: "Your reply has been posted." });
  };

  const coursesInData = useMemo(() => {
    const codes = allPosts.filter((p) => p.course).map((p) => p.course!);
    return [...new Set(codes)].sort();
  }, [allPosts]);

  const filtered = useMemo(() => {
    let result = allPosts.filter((p) => {
      if (filterTag !== "all" && p.tag !== filterTag) return false;
      if (filterCourse !== "all" && p.course !== filterCourse) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.content.toLowerCase().includes(q) ||
          p.anonymous_id.toLowerCase().includes(q) ||
          (p.course && p.course.toLowerCase().includes(q))
        );
      }
      return true;
    });

    if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else if (sortBy === "trending") {
      result.sort((a, b) => {
        const totalA = Object.values(a.reactions).reduce((s, v) => s + v, 0) + a.replies;
        const totalB = Object.values(b.reactions).reduce((s, v) => s + v, 0) + b.replies;
        return totalB - totalA;
      });
    } else if (sortBy === "discussed") {
      result.sort((a, b) => b.replies - a.replies);
    }

    return result;
  }, [allPosts, filterTag, filterCourse, sortBy, search]);

  const stats = useMemo(() => {
    const total = allPosts.length;
    const totalReactions = allPosts.reduce(
      (s, p) => s + Object.values(p.reactions).reduce((a, b) => a + b, 0),
      0
    );
    const totalReplies = allPosts.reduce((s, p) => s + p.replies, 0);
    return { total, totalReactions, totalReplies };
  }, [allPosts]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Social</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">The Lounge</h1>
        <p className="text-xs text-muted-foreground mt-1">Anonymous academic feed · Be real, be kind</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Posts</p>
            <p className="text-2xl font-black tabular-nums mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Reactions</p>
            <p className="text-2xl font-black tabular-nums mt-1">{stats.totalReactions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Replies</p>
            <p className="text-2xl font-black tabular-nums mt-1">{stats.totalReplies}</p>
          </CardContent>
        </Card>
      </div>

      {/* Compose */}
      <ComposeBox onPost={handlePost} />

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts, users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-widest font-bold">Feed</span>
          </div>

          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {POST_TAGS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {coursesInData.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Newest</span>
              </SelectItem>
              <SelectItem value="trending">
                <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Trending</span>
              </SelectItem>
              <SelectItem value="discussed">
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Most Discussed</span>
              </SelectItem>
            </SelectContent>
          </Select>

          {(filterTag !== "all" || filterCourse !== "all" || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setFilterTag("all");
                setFilterCourse("all");
                setSearch("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 p-12 flex flex-col items-center gap-2">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm uppercase tracking-wider text-muted-foreground">No posts yet</p>
          <p className="text-xs text-muted-foreground/60">Be the first to break the silence</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              userReactions={userReactions[post.id] || new Set()}
              localReplies={localReplies[post.id] || []}
              onReact={handleReact}
              onAddReply={handleAddReply}
            />
          ))}
        </div>
      )}

      {/* Reaction legend */}
      <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-widest text-muted-foreground border-t border-border pt-4">
        {REACTIONS.map((r) => (
          <span key={r.emoji} className="flex items-center gap-1">
            <span className="text-sm">{r.emoji}</span> {r.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Lounge;
