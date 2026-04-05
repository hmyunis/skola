import {
    useState,
    useMemo,
    useEffect,
    useRef,
    useCallback,
    type ChangeEventHandler,
    type ClipboardEventHandler,
    type ReactNode,
} from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import {
    fetchLoungeFeed,
    fetchPostReplies,
    createPost,
    editPost as apiEditPost,
    deletePost as apiDeletePost,
    reactToPost,
    addReply,
    deleteReply as apiDeleteReply,
    searchMentionableUsers,
    POST_TAGS,
    REACTIONS,
    type LoungePost,
    type LoungeReply,
    type LoungeFeedResponse,
    type MentionableUser,
    type PostTag,
    type AcademicReaction,
} from '@/services/lounge';
import { CourseSelectDropdown } from '@/components/CourseSelectDropdown';
import { useAuth } from '@/stores/authStore';
import { useSemesterStore } from '@/stores/semesterStore';
import { useFeatureEnabled } from '@/services/features';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    Pencil,
    Trash2,
    Shield,
    Flag,
    Loader2,
    ImagePlus,
    ImageOff,
    Maximize2,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { ReportDialog } from '@/components/ReportDialog';

// ─── Time ago helper ───
function parseServerTimestamp(timestamp: string): Date {
    const value = String(timestamp || '').trim();
    if (!value) return new Date(Number.NaN);

    // Treat timezone-less ISO-like strings as UTC to avoid client locale drift.
    const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
    const normalized = hasTimezone ? value : `${value}Z`;
    return new Date(normalized);
}

function timeAgo(timestamp: string): string {
    const now = new Date();
    const then = parseServerTimestamp(timestamp);
    if (Number.isNaN(then.getTime())) return '';
    const diffMs = now.getTime() - then.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function formatExactTime(timestamp: string): string {
    const d = parseServerTimestamp(timestamp);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function isContentEdited(createdAt: string, editedAt?: string | null): boolean {
    if (!editedAt) return false;
    const createdMs = parseServerTimestamp(createdAt).getTime();
    const editedMs = parseServerTimestamp(editedAt).getTime();
    if (Number.isNaN(createdMs) || Number.isNaN(editedMs)) return false;
    return editedMs > createdMs + 1000;
}

function renderMentionHighlightedText(text: string): ReactNode[] {
    if (!text) return [''];

    const nodes: ReactNode[] = [];
    const regex = /@([a-zA-Z0-9._-]{2,80}|everyone)\b/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        const matchIndex = match.index;
        const mentionText = match[0];
        const prevChar = matchIndex > 0 ? text[matchIndex - 1] : '';

        // Avoid false positives inside words like emails.
        if (prevChar && /[a-zA-Z0-9._-]/.test(prevChar)) {
            continue;
        }

        if (matchIndex > lastIndex) {
            nodes.push(text.slice(lastIndex, matchIndex));
        }

        nodes.push(
            <span key={`mention-${matchIndex}`} className="text-primary font-semibold">
                {mentionText}
            </span>,
        );
        lastIndex = matchIndex + mentionText.length;
    }

    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }

    return nodes.length ? nodes : [text];
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

// ─── Reaction Button ───
function ReactionButton({
    emoji,
    label,
    count,
    active,
    disabled,
    onClick,
}: {
    emoji: string;
    label: string;
    count: number;
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick();
                    }}
                    disabled={disabled}
                    className={cn(
                        'flex items-center gap-1 px-2 py-1 border text-xs tabular-nums transition-all',
                        active
                            ? 'bg-primary/10 border-primary/40 text-primary font-bold'
                            : 'border-border text-muted-foreground hover:bg-accent',
                        disabled && 'opacity-50 cursor-not-allowed',
                    )}
                >
                    <span>{emoji}</span>
                    <span>{count}</span>
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">
                <span>{label}</span>
            </TooltipContent>
        </Tooltip>
    );
}

// ─── Reply Item ───
function ReplyItem({
    reply,
    isOwner,
    isAdmin,
    onDelete,
}: {
    reply: LoungeReply;
    isOwner: boolean;
    isAdmin: boolean;
    onDelete: () => void;
}) {
    const displayName = reply.isAnonymous
        ? reply.author.anonymousId || 'Anonymous'
        : reply.author.name;
    const edited = isContentEdited(reply.createdAt, reply.editedAt);

    return (
        <div className="flex gap-2 py-2 group">
            <CornerDownRight className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
            <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {reply.isAnonymous ? (
                        <User className="h-2.5 w-2.5" />
                    ) : (
                        <UserCheck className="h-2.5 w-2.5 text-primary" />
                    )}
                    <span className={cn('font-medium', !reply.isAnonymous && 'text-foreground')}>
                        {displayName}
                    </span>
                    <span className="opacity-50">·</span>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-default">{timeAgo(reply.createdAt)}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <span>{formatExactTime(reply.createdAt)}</span>
                        </TooltipContent>
                    </Tooltip>
                    {edited && (
                        <>
                            <span className="opacity-50">·</span>
                            <span className="text-[10px] font-medium text-primary/80">edited</span>
                        </>
                    )}
                    <div className="flex-1" />
                    {(isOwner || isAdmin) && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete();
                                    }}
                                    className={cn(
                                        'opacity-0 group-hover:opacity-100 transition-opacity',
                                        isOwner
                                            ? 'text-muted-foreground hover:text-destructive'
                                            : 'text-amber-500 hover:text-destructive',
                                    )}
                                >
                                    {!isOwner && isAdmin ? (
                                        <Shield className="h-2.5 w-2.5" />
                                    ) : (
                                        <Trash2 className="h-2.5 w-2.5" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <span>{isOwner ? 'Delete reply' : 'Delete reply (admin)'}</span>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{renderMentionHighlightedText(reply.content)}</p>
            </div>
        </div>
    );
}

// ─── Replies Section ───
function RepliesSection({ postId, replyCount }: { postId: string; replyCount: number }) {
    const { isAdmin, user } = useAuth();
    const queryClient = useQueryClient();
    const [expanded, setExpanded] = useState(false);
    const replyInputRef = useRef<HTMLInputElement | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
    const [activeMentionIndex, setActiveMentionIndex] = useState(0);
    const anonEnabled = useFeatureEnabled('ft-anon-posting');
    const isMentionMenuOpen = mentionQuery !== null && mentionRange !== null;

    useEffect(() => {
        if (!anonEnabled) setIsAnonymous(false);
    }, [anonEnabled]);

    const {
        data: mentionPages,
        fetchNextPage: fetchNextMentionPage,
        hasNextPage: hasNextMentionPage,
        isFetchingNextPage: isFetchingNextMentionPage,
        isLoading: isMentionLoading,
    } = useInfiniteQuery({
        queryKey: ['loungeReplyMentionUsers', mentionQuery || ''],
        queryFn: ({ pageParam = 1 }) =>
            searchMentionableUsers({
                q: mentionQuery || undefined,
                page: pageParam,
                limit: 20,
            }),
        enabled: isMentionMenuOpen,
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            if (lastPage.meta.page < lastPage.meta.lastPage) {
                return lastPage.meta.page + 1;
            }
            return undefined;
        },
    });

    const fetchedMentionUsers = useMemo(
        () => mentionPages?.pages.flatMap((page) => page.data) ?? [],
        [mentionPages],
    );

    const mentionOptions = useMemo<
        Array<
            MentionableUser & {
                isEveryone?: boolean;
            }
        >
    >(() => {
        if (!isMentionMenuOpen) return [];

        const query = (mentionQuery || '').toLowerCase();
        const includeEveryone = !query || 'everyone'.includes(query);
        const dedupedUsers: MentionableUser[] = [];
        const seen = new Set<string>();
        for (const mentionable of fetchedMentionUsers) {
            if (!mentionable?.id || seen.has(mentionable.id)) continue;
            seen.add(mentionable.id);
            dedupedUsers.push(mentionable);
        }

        if (!includeEveryone) return dedupedUsers;

        return [
            {
                id: 'everyone',
                name: 'Everyone',
                username: 'everyone',
                mentionKey: 'everyone',
                isEveryone: true,
            },
            ...dedupedUsers,
        ];
    }, [fetchedMentionUsers, isMentionMenuOpen, mentionQuery]);

    useEffect(() => {
        setActiveMentionIndex(0);
    }, [mentionQuery, mentionOptions.length]);

    const closeMentionMenu = () => {
        setMentionQuery(null);
        setMentionRange(null);
        setActiveMentionIndex(0);
    };

    const updateMentionContext = (nextText: string, caret: number | null | undefined) => {
        if (caret === null || caret === undefined) {
            closeMentionMenu();
            return;
        }
        const ctx = getActiveMentionContext(nextText, caret);
        if (!ctx) {
            closeMentionMenu();
            return;
        }
        setMentionRange({ start: ctx.start, end: ctx.end });
        setMentionQuery(ctx.query);
    };

    const applyMention = (
        option: MentionableUser & {
            isEveryone?: boolean;
        },
    ) => {
        if (!mentionRange) return;
        const insertion = `@${option.mentionKey} `;
        const nextText =
            replyText.slice(0, mentionRange.start) + insertion + replyText.slice(mentionRange.end);
        const nextCaret = Math.min(mentionRange.start + insertion.length, nextText.length);

        setReplyText(nextText);
        closeMentionMenu();

        requestAnimationFrame(() => {
            if (!replyInputRef.current) return;
            replyInputRef.current.focus();
            replyInputRef.current.setSelectionRange(nextCaret, nextCaret);
        });
    };

    const { data: replies, isLoading } = useQuery({
        queryKey: ['loungeReplies', postId],
        queryFn: () => fetchPostReplies(postId),
        enabled: expanded,
    });

    const addReplyMutation = useMutation({
        mutationFn: (data: { content: string; isAnonymous: boolean }) => addReply(postId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['loungeReplies', postId] });
            queryClient.invalidateQueries({ queryKey: ['loungeFeed'] });
            queryClient.invalidateQueries({ queryKey: ['loungeStats'] });
            setReplyText('');
            closeMentionMenu();
        },
    });

    const deleteReplyMutation = useMutation({
        mutationFn: (replyId: string) => apiDeleteReply(replyId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['loungeReplies', postId] });
            queryClient.invalidateQueries({ queryKey: ['loungeFeed'] });
            queryClient.invalidateQueries({ queryKey: ['loungeStats'] });
        },
    });

    const handleSubmit = () => {
        if (!replyText.trim()) return;
        toast
            .promise(addReplyMutation.mutateAsync({ content: replyText.trim(), isAnonymous }), {
                loading: {
                    title: 'Posting Reply',
                    description: 'Sending your reply...',
                },
                success: {
                    title: 'Replied!',
                    description: 'Your reply has been posted.',
                },
                error: (error) => ({
                    title: 'Error',
                    description: getErrorMessage(error, 'Failed to post reply.'),
                    variant: 'destructive',
                }),
            })
            .catch(() => {
                // handled by toast.promise
            });
    };

    const handleDeleteReply = (replyId: string) => {
        toast
            .promise(deleteReplyMutation.mutateAsync(replyId), {
                loading: {
                    title: 'Deleting Reply',
                    description: 'Removing reply...',
                },
                success: {
                    title: 'Deleted',
                    description: 'Reply has been removed.',
                },
                error: (error) => ({
                    title: 'Error',
                    description: getErrorMessage(error, 'Failed to delete reply.'),
                    variant: 'destructive',
                }),
            })
            .catch(() => {
                // handled by toast.promise
            });
    };

    const isReplyOwner = (reply: LoungeReply) => reply.authorId === user?.id;

    const allReplies = replies || [];

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
                    {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                </span>
            </button>

            {expanded && (
                <div className="ml-2 border-l-2 border-border pl-3 space-y-1">
                    {isLoading ? (
                        <div className="py-2 space-y-2">
                            {[1, 2].map((i) => (
                                <div key={i} className="flex items-center gap-2 py-1">
                                    <div className="h-2.5 w-16 bg-muted animate-pulse" />
                                    <div className="h-2.5 w-full bg-muted animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : allReplies.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground py-2">
                            No replies yet. Be the first!
                        </p>
                    ) : (
                        allReplies.map((r) => (
                            <ReplyItem
                                key={r.id}
                                reply={r}
                                isOwner={isReplyOwner(r)}
                                isAdmin={isAdmin}
                                onDelete={() => handleDeleteReply(r.id)}
                            />
                        ))
                    )}

                    {/* Reply input */}
                    <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Input
                                    ref={replyInputRef}
                                    placeholder="Write a reply..."
                                    value={replyText}
                                    onChange={(e) => {
                                        const nextValue = e.target.value;
                                        setReplyText(nextValue);
                                        updateMentionContext(nextValue, e.target.selectionStart);
                                    }}
                                    onClick={(e) => {
                                        updateMentionContext(
                                            e.currentTarget.value,
                                            e.currentTarget.selectionStart,
                                        );
                                    }}
                                    onKeyUp={(e) => {
                                        updateMentionContext(
                                            e.currentTarget.value,
                                            e.currentTarget.selectionStart,
                                        );
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => {
                                            closeMentionMenu();
                                        }, 120);
                                    }}
                                    onKeyDown={(e) => {
                                        if (isMentionMenuOpen && mentionOptions.length > 0) {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setActiveMentionIndex((prev) =>
                                                    Math.min(prev + 1, mentionOptions.length - 1),
                                                );
                                                return;
                                            }

                                            if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setActiveMentionIndex((prev) =>
                                                    Math.max(prev - 1, 0),
                                                );
                                                return;
                                            }

                                            if (e.key === 'Enter' || e.key === 'Tab') {
                                                e.preventDefault();
                                                const selected = mentionOptions[activeMentionIndex];
                                                if (selected) {
                                                    applyMention(selected);
                                                }
                                                return;
                                            }

                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                closeMentionMenu();
                                                return;
                                            }
                                        }

                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                    className="h-7 text-xs flex-1"
                                />
                                {isMentionMenuOpen && (
                                    <div
                                        className="absolute left-0 right-0 top-full mt-1 z-20 border border-border bg-popover shadow-md max-h-48 overflow-y-auto"
                                        onScroll={(event) => {
                                            const el = event.currentTarget;
                                            const isNearBottom =
                                                el.scrollTop + el.clientHeight >=
                                                el.scrollHeight - 40;
                                            if (
                                                isNearBottom &&
                                                hasNextMentionPage &&
                                                !isFetchingNextMentionPage
                                            ) {
                                                void fetchNextMentionPage();
                                            }
                                        }}
                                    >
                                        {mentionOptions.length === 0 && (
                                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                                {isMentionLoading
                                                    ? 'Loading users...'
                                                    : 'No users match this mention.'}
                                            </div>
                                        )}

                                        {mentionOptions.map((option, index) => {
                                            const mentionLabel = `@${option.mentionKey}`;
                                            const subtitle = option.isEveryone
                                                ? 'Notify everyone in this classroom'
                                                : option.username
                                                    ? option.name
                                                    : `${option.name} - no username`;
                                            const isActive = index === activeMentionIndex;

                                            return (
                                                <button
                                                    key={`${option.id}-${option.mentionKey}`}
                                                    type="button"
                                                    onMouseDown={(event) => {
                                                        event.preventDefault();
                                                        applyMention(option);
                                                    }}
                                                    className={cn(
                                                        'w-full text-left px-3 py-2 border-b border-border/60 last:border-b-0 hover:bg-accent transition-colors',
                                                        isActive && 'bg-accent',
                                                    )}
                                                >
                                                    <p className="text-xs font-semibold truncate">
                                                        {mentionLabel}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground truncate">
                                                        {subtitle}
                                                    </p>
                                                </button>
                                            );
                                        })}

                                        {isFetchingNextMentionPage && mentionOptions.length > 0 && (
                                            <div className="px-3 py-2 text-[10px] text-muted-foreground">
                                                Loading more...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {anonEnabled && (
                                <div className="flex items-center gap-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-muted-foreground">
                                                    Anon
                                                </span>
                                                <Switch
                                                    checked={isAnonymous}
                                                    onCheckedChange={setIsAnonymous}
                                                    className="scale-[0.6]"
                                                />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <span>Post anonymously</span>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            )}
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={handleSubmit}
                                disabled={!replyText.trim() || addReplyMutation.isPending}
                            >
                                {addReplyMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Send className="h-3 w-3" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Edit Post Dialog ───
function EditPostDialog({
    post,
    open,
    onOpenChange,
    onSave,
    isPending,
}: {
    post: LoungePost | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (id: string, content: string, tag: PostTag) => void;
    isPending: boolean;
}) {
    const [content, setContent] = useState(post?.content || '');
    const [tag, setTag] = useState<PostTag>((post?.tags?.[0] as PostTag) || 'discussion');

    // Sync state when a different post is opened for editing
    useEffect(() => {
        if (post) {
            setContent(post.content);
            setTag((post.tags?.[0] as PostTag) || 'discussion');
        }
    }, [post]);

    const maxChars = 500;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="uppercase tracking-wider text-sm">
                        Edit Post
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value.slice(0, maxChars))}
                        className="min-h-[100px] text-sm resize-none"
                        rows={4}
                    />
                    <div className="flex items-center gap-3">
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
                        <div className="flex-1" />
                        <span
                            className={cn(
                                'text-[10px] tabular-nums',
                                content.length > maxChars * 0.9
                                    ? 'text-destructive'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {content.length}/{maxChars}
                        </span>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (post && content.trim()) {
                                    onSave(post.id, content.trim(), tag);
                                }
                            }}
                            disabled={!content.trim() || isPending}
                        >
                            {isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Pencil className="h-3 w-3" />
                            )}
                            Save Changes
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Post Card ───
function PostCard({
    post,
    isOwner,
    isAdmin,
    onReact,
    reactPending,
    onEdit,
    onDelete,
}: {
    post: LoungePost;
    isOwner: boolean;
    isAdmin: boolean;
    onReact: (postId: string, reaction: AcademicReaction) => void;
    reactPending: boolean;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [reportOpen, setReportOpen] = useState(false);
    const [isImageBroken, setIsImageBroken] = useState(false);
    const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
    const primaryTag = post.tags?.[0] as PostTag | undefined;
    const tagConfig = primaryTag ? POST_TAGS.find((t) => t.value === primaryTag) : null;
    const courseName = post.course;

    const displayName = post.isAnonymous
        ? post.author.anonymousId || 'Anonymous'
        : post.author.name;
    const edited = isContentEdited(post.createdAt, post.editedAt);

    const sortedReactions = REACTIONS.map((r) => ({
        ...r,
        count: post.reactions[r.emoji] || 0,
    })).sort((a, b) => b.count - a.count);

    useEffect(() => {
        setIsImageBroken(false);
        setIsImageDialogOpen(false);
    }, [post.id, post.imageUrl]);

    return (
        <div className="border border-border bg-card p-4 space-y-3 hover:bg-card transition-colors group/post">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2">
                {tagConfig && (
                    <span
                        className={cn(
                            'px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider',
                            tagConfig.color,
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

                {/* Edit / Delete actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover/post:opacity-100 transition-opacity">
                    {!isOwner && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setReportOpen(true)}
                                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    <Flag className="h-3.5 w-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <span>Report post</span>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {isOwner && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={onEdit}
                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <span>Edit post</span>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {(isOwner || isAdmin) && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={onDelete}
                                    className={cn(
                                        'p-1 transition-colors',
                                        isOwner
                                            ? 'text-muted-foreground hover:text-destructive'
                                            : 'text-amber-500 hover:text-destructive',
                                    )}
                                >
                                    {!isOwner && isAdmin ? (
                                        <Shield className="h-3.5 w-3.5" />
                                    ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <span>{isOwner ? 'Delete post' : 'Delete post (admin)'}</span>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {post.isAnonymous ? (
                        <User className="h-3 w-3" />
                    ) : (
                        <UserCheck className="h-3 w-3 text-primary" />
                    )}
                    <span className={cn('font-medium', !post.isAnonymous && 'text-foreground')}>
                        {displayName}
                    </span>
                    <span className="opacity-50">·</span>
                    <Clock className="h-3 w-3" />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-default">{timeAgo(post.createdAt)}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <span>{formatExactTime(post.createdAt)}</span>
                        </TooltipContent>
                    </Tooltip>
                    {edited && (
                        <>
                            <span className="opacity-50">·</span>
                            <span className="text-[10px] font-medium text-primary/80">edited</span>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            {post.content && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {renderMentionHighlightedText(post.content)}
                </p>
            )}
            {post.imageUrl && !isImageBroken && (
                <div className="relative overflow-hidden border border-border bg-muted/20">
                    <img
                        src={post.imageUrl}
                        alt="Lounge attachment"
                        loading="lazy"
                        className="w-full max-h-[420px] object-cover"
                        onError={() => setIsImageBroken(true)}
                    />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={() => setIsImageDialogOpen(true)}
                                className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                aria-label="Open full image"
                            >
                                <Maximize2 className="h-4 w-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <span>View full image</span>
                        </TooltipContent>
                    </Tooltip>
                </div>
            )}
            {post.imageUrl && isImageBroken && (
                <div className="border border-dashed border-border p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <ImageOff className="h-3.5 w-3.5 shrink-0" />
                    <span>Image unavailable or broken link.</span>
                    <a
                        href={post.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4 hover:text-foreground"
                    >
                        Open link
                    </a>
                </div>
            )}
            {post.imageUrl && !isImageBroken && (
                <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                    <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl border-none bg-transparent p-0 shadow-none [&>button]:hidden">
                        <DialogHeader className="sr-only">
                            <DialogTitle>Lounge attachment</DialogTitle>
                        </DialogHeader>
                        <div className="overflow-hidden rounded-md border border-border/50 bg-black/90">
                            <img
                                src={post.imageUrl}
                                alt="Lounge attachment full view"
                                className="w-full max-h-[calc(100vh-1rem)] object-contain sm:max-h-[calc(100vh-2rem)]"
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
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
                        active={post.userReaction === r.emoji}
                        disabled={reactPending}
                        onClick={() => onReact(post.id, r.emoji)}
                    />
                ))}
            </div>

            {/* Replies section */}
            <RepliesSection postId={post.id} replyCount={post.replyCount} />
            <ReportDialog
                open={reportOpen}
                onOpenChange={setReportOpen}
                contentType="post"
                contentId={post.id}
                contentPreview={post.content || '[Image attachment]'}
                contentAuthor={displayName}
            />
        </div>
    );
}

// ─── Compose Box ───
function getActiveMentionContext(text: string, caret: number) {
    if (!text || caret < 0) return null;

    const safeCaret = Math.min(caret, text.length);
    const atIndex = text.lastIndexOf('@', safeCaret - 1);
    if (atIndex < 0) return null;

    const prevChar = atIndex > 0 ? text[atIndex - 1] : '';
    if (prevChar && /[a-zA-Z0-9._-]/.test(prevChar)) {
        return null;
    }

    const rawToken = text.slice(atIndex + 1, safeCaret);
    if (rawToken.length > 80) return null;
    if (/[\s]/.test(rawToken)) return null;
    if (/[^a-zA-Z0-9._-]/.test(rawToken)) return null;

    return {
        start: atIndex,
        end: safeCaret,
        query: rawToken.toLowerCase(),
    };
}

function ComposeBox({
    onPost,
    isPending,
}: {
    onPost: (
        content: string | undefined,
        tag: PostTag,
        course?: string,
        isAnonymous?: boolean,
        imageDataUrl?: string,
        imageName?: string,
    ) => void;
    isPending: boolean;
}) {
    const { userName } = useAuth();
    const { activeSemester } = useSemesterStore();
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [content, setContent] = useState('');
    const [tag, setTag] = useState<PostTag>('discussion');
    const [course, setCourse] = useState<string>('none');
    const [expanded, setExpanded] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
    const [imageName, setImageName] = useState<string>('');
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
    const [activeMentionIndex, setActiveMentionIndex] = useState(0);
    const anonEnabled = useFeatureEnabled('ft-anon-posting');

    useEffect(() => {
        if (!anonEnabled) setIsAnonymous(false);
    }, [anonEnabled]);

    const maxChars = 500;
    const isMentionMenuOpen = mentionQuery !== null && mentionRange !== null;

    const {
        data: mentionPages,
        fetchNextPage: fetchNextMentionPage,
        hasNextPage: hasNextMentionPage,
        isFetchingNextPage: isFetchingNextMentionPage,
        isLoading: isMentionLoading,
    } = useInfiniteQuery({
        queryKey: ['loungeMentionUsers', mentionQuery || ''],
        queryFn: ({ pageParam = 1 }) =>
            searchMentionableUsers({
                q: mentionQuery || undefined,
                page: pageParam,
                limit: 20,
            }),
        enabled: isMentionMenuOpen,
        initialPageParam: 1,
        getNextPageParam: (lastPage) => {
            if (lastPage.meta.page < lastPage.meta.lastPage) {
                return lastPage.meta.page + 1;
            }
            return undefined;
        },
    });

    const fetchedMentionUsers = useMemo(
        () => mentionPages?.pages.flatMap((page) => page.data) ?? [],
        [mentionPages],
    );

    const mentionOptions = useMemo<
        Array<
            MentionableUser & {
                isEveryone?: boolean;
            }
        >
    >(() => {
        if (!isMentionMenuOpen) return [];

        const query = (mentionQuery || '').toLowerCase();
        const includeEveryone = !query || 'everyone'.includes(query);
        const dedupedUsers: MentionableUser[] = [];
        const seen = new Set<string>();
        for (const user of fetchedMentionUsers) {
            if (!user?.id || seen.has(user.id)) continue;
            seen.add(user.id);
            dedupedUsers.push(user);
        }

        if (!includeEveryone) return dedupedUsers;

        return [
            {
                id: 'everyone',
                name: 'Everyone',
                username: 'everyone',
                mentionKey: 'everyone',
                isEveryone: true,
            },
            ...dedupedUsers,
        ];
    }, [fetchedMentionUsers, isMentionMenuOpen, mentionQuery]);

    useEffect(() => {
        setActiveMentionIndex(0);
    }, [mentionQuery, mentionOptions.length]);

    const closeMentionMenu = () => {
        setMentionQuery(null);
        setMentionRange(null);
        setActiveMentionIndex(0);
    };

    const updateMentionContext = (nextText: string, caret: number | null | undefined) => {
        if (caret === null || caret === undefined) {
            closeMentionMenu();
            return;
        }
        const ctx = getActiveMentionContext(nextText, caret);
        if (!ctx) {
            closeMentionMenu();
            return;
        }
        setMentionRange({ start: ctx.start, end: ctx.end });
        setMentionQuery(ctx.query);
    };

    const applyMention = (
        option: MentionableUser & {
            isEveryone?: boolean;
        },
    ) => {
        if (!mentionRange) return;
        const insertion = `@${option.mentionKey} `;
        const nextText =
            content.slice(0, mentionRange.start) + insertion + content.slice(mentionRange.end);
        const bounded = nextText.slice(0, maxChars);
        const nextCaret = Math.min(mentionRange.start + insertion.length, bounded.length);

        setContent(bounded);
        closeMentionMenu();
        setExpanded(true);

        requestAnimationFrame(() => {
            if (!textareaRef.current) return;
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(nextCaret, nextCaret);
        });
    };

    const handleSubmit = () => {
        if (!content.trim() && !imageDataUrl) return;
        onPost(
            content.trim() || undefined,
            tag,
            course === 'none' ? undefined : course,
            isAnonymous,
            imageDataUrl || undefined,
            imageName || undefined,
        );
        setContent('');
        setTag('discussion');
        setCourse('none');
        setExpanded(false);
        setIsAnonymous(false);
        setImageDataUrl(null);
        setImageName('');
        closeMentionMenu();
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const readImageFile = (file: File, fallbackName: string) => {
        if (!file.type.startsWith('image/')) {
            toast({
                title: 'Invalid File',
                description: 'Please choose an image file.',
                variant: 'destructive',
            });
            return;
        }

        const maxSizeBytes = 8 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            toast({
                title: 'Image Too Large',
                description: 'Max image size is 8MB.',
                variant: 'destructive',
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            if (!result.startsWith('data:image/')) {
                toast({
                    title: 'Invalid Image',
                    description: 'Could not read image data.',
                    variant: 'destructive',
                });
                return;
            }

            setImageDataUrl(result);
            setImageName(file.name?.trim() || fallbackName);
            setExpanded(true);
        };
        reader.onerror = () => {
            toast({
                title: 'Image Error',
                description: 'Failed to read image file.',
                variant: 'destructive',
            });
        };
        reader.readAsDataURL(file);
    };

    const getImageExtension = (mimeType: string) => {
        if (mimeType === 'image/jpeg') return 'jpg';
        if (mimeType === 'image/png') return 'png';
        if (mimeType === 'image/webp') return 'webp';
        if (mimeType === 'image/gif') return 'gif';
        return 'png';
    };

    const handleImageSelection: ChangeEventHandler<HTMLInputElement> = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        readImageFile(file, `uploaded-image.${getImageExtension(file.type)}`);
        event.target.value = '';
    };

    const handlePasteImage: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
        const clipboardItems = Array.from(event.clipboardData?.items ?? []);
        const imageItem = clipboardItems.find((item) => item.type.startsWith('image/'));
        if (!imageItem) return;

        const file = imageItem.getAsFile();
        if (!file) {
            toast({
                title: 'Image Error',
                description: 'Could not read image from clipboard.',
                variant: 'destructive',
            });
            return;
        }

        event.preventDefault();
        readImageFile(file, `pasted-image.${getImageExtension(file.type)}`);
    };

    const removeSelectedImage = () => {
        setImageDataUrl(null);
        setImageName('');
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const charCount = content.length;

    return (
        <Card>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <div className="h-7 w-7 bg-muted border border-border flex items-center justify-center">
                        {isAnonymous ? (
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                            <UserCheck className="h-3.5 w-3.5 text-primary" />
                        )}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {isAnonymous ? 'Posting Anonymously' : `Posting as ${userName}`}
                    </span>
                    <div className="flex-1" />
                    {anonEnabled && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">Anonymous</span>
                            <Switch
                                checked={isAnonymous}
                                onCheckedChange={setIsAnonymous}
                                className="scale-75"
                            />
                        </div>
                    )}
                </div>

                <div className="relative">
                    <Textarea
                        ref={textareaRef}
                        placeholder="What's on your mind? Rant, ask, share..."
                        value={content}
                        onChange={(e) => {
                            const nextValue = e.target.value.slice(0, maxChars);
                            setContent(nextValue);
                            if (!expanded) setExpanded(true);
                            updateMentionContext(nextValue, e.target.selectionStart);
                        }}
                        onFocus={() => setExpanded(true)}
                        onPaste={handlePasteImage}
                        onClick={(e) => {
                            updateMentionContext(e.currentTarget.value, e.currentTarget.selectionStart);
                        }}
                        onKeyUp={(e) => {
                            updateMentionContext(e.currentTarget.value, e.currentTarget.selectionStart);
                        }}
                        onBlur={() => {
                            setTimeout(() => {
                                closeMentionMenu();
                            }, 120);
                        }}
                        onKeyDown={(e) => {
                            if (!isMentionMenuOpen || mentionOptions.length === 0) return;

                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setActiveMentionIndex((prev) =>
                                    Math.min(prev + 1, mentionOptions.length - 1),
                                );
                                return;
                            }

                            if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setActiveMentionIndex((prev) => Math.max(prev - 1, 0));
                                return;
                            }

                            if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                const selected = mentionOptions[activeMentionIndex];
                                if (selected) {
                                    applyMention(selected);
                                }
                                return;
                            }

                            if (e.key === 'Escape') {
                                e.preventDefault();
                                closeMentionMenu();
                            }
                        }}
                        className="min-h-[60px] text-sm resize-none"
                        rows={expanded ? 3 : 2}
                    />

                    {isMentionMenuOpen && (
                        <div
                            className="absolute left-0 right-0 top-full mt-1 z-20 border border-border bg-popover shadow-md max-h-56 overflow-y-auto"
                            onScroll={(event) => {
                                const el = event.currentTarget;
                                const isNearBottom =
                                    el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
                                if (
                                    isNearBottom &&
                                    hasNextMentionPage &&
                                    !isFetchingNextMentionPage
                                ) {
                                    void fetchNextMentionPage();
                                }
                            }}
                        >
                            {mentionOptions.length === 0 && (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                    {isMentionLoading
                                        ? 'Loading users...'
                                        : 'No users match this mention.'}
                                </div>
                            )}

                            {mentionOptions.map((option, index) => {
                                const mentionLabel = `@${option.mentionKey}`;
                                const subtitle = option.isEveryone
                                    ? 'Notify everyone in this classroom'
                                    : option.username
                                        ? option.name
                                        : `${option.name} - no username`;
                                const isActive = index === activeMentionIndex;

                                return (
                                    <button
                                        key={`${option.id}-${option.mentionKey}`}
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            applyMention(option);
                                        }}
                                        className={cn(
                                            'w-full text-left px-3 py-2 border-b border-border/60 last:border-b-0 hover:bg-accent transition-colors',
                                            isActive && 'bg-accent',
                                        )}
                                    >
                                        <p className="text-xs font-semibold truncate">{mentionLabel}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                            {subtitle}
                                        </p>
                                    </button>
                                );
                            })}

                            {isFetchingNextMentionPage && mentionOptions.length > 0 && (
                                <div className="px-3 py-2 text-[10px] text-muted-foreground">
                                    Loading more...
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelection}
                />

                {imageDataUrl && (
                    <div className="space-y-2">
                        <div className="overflow-hidden border border-border bg-muted/20">
                            <img
                                src={imageDataUrl}
                                alt="Attachment preview"
                                className="w-full max-h-[280px] object-cover"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="truncate">{imageName || 'Selected image'}</span>
                            <button
                                type="button"
                                onClick={removeSelectedImage}
                                className="inline-flex items-center gap-1 hover:text-destructive"
                            >
                                <X className="h-3 w-3" />
                                Remove
                            </button>
                        </div>
                    </div>
                )}

                {expanded && (
                    <div className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                            <Select value={tag} onValueChange={(v) => setTag(v as PostTag)}>
                                <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
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

                            <CourseSelectDropdown
                                value={course}
                                onChange={setCourse}
                                placeholder="Course (optional)"
                                className="w-full sm:w-[130px]"
                                semesterId={activeSemester?.id}
                            />

                            <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs flex-1 sm:flex-none"
                                    onClick={() => imageInputRef.current?.click()}
                                >
                                    <ImagePlus className="h-3 w-3" />
                                    {imageDataUrl ? 'Replace Image' : 'Attach Image'}
                                </Button>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    or paste (Ctrl+V)
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto sm:justify-end">
                            <span
                                className={cn(
                                    'text-[10px] tabular-nums ml-auto sm:ml-0',
                                    charCount > maxChars * 0.9
                                        ? 'text-destructive'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {charCount}/{maxChars}
                            </span>

                            <Button
                                size="sm"
                                className="flex-1 sm:flex-none"
                                onClick={handleSubmit}
                                disabled={(!content.trim() && !imageDataUrl) || isPending}
                            >
                                {isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Send className="h-3 w-3" />
                                )}
                                Post
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Main Page ───
const Lounge = () => {
    const { isAdmin, user } = useAuth();
    const queryClient = useQueryClient();
    const { activeSemester, reload: reloadSemesters } = useSemesterStore();

    useEffect(() => {
        reloadSemesters();
    }, []);

    const [search, setSearch] = useState('');
    const [filterTag, setFilterTag] = useState<string>('all');
    const [filterCourse, setFilterCourse] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('newest');

    // Edit/delete state
    const [editingPost, setEditingPost] = useState<LoungePost | null>(null);
    const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // ─── Queries ───
    const {
        data: feedData,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery({
        queryKey: [
            'loungeFeed',
            {
                search: search || undefined,
                tag: filterTag !== 'all' ? filterTag : undefined,
                course: filterCourse !== 'all' ? filterCourse : undefined,
                sort: sortBy,
            },
        ],
        queryFn: ({ pageParam = 1 }) =>
            fetchLoungeFeed({
                page: pageParam,
                limit: 20,
                search: search || undefined,
                tag: filterTag !== 'all' ? filterTag : undefined,
                course: filterCourse !== 'all' ? filterCourse : undefined,
                sort: sortBy,
            }),
        getNextPageParam: (lastPage) => {
            if (lastPage.meta.page < lastPage.meta.lastPage) {
                return lastPage.meta.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
    });

    const posts = feedData?.pages.flatMap((page) => page.data) ?? [];

    // Infinite scroll observer
    const lastPostRef = useCallback(
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

    // ─── Mutations ───
    const createPostMutation = useMutation({
        mutationFn: createPost,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['loungeFeed'] });
        },
    });

    const editPostMutation = useMutation({
        mutationFn: ({
            id,
            ...data
        }: {
            id: string;
            content?: string;
            tags?: string[];
            course?: string;
        }) => apiEditPost(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['loungeFeed'] });
            setEditingPost(null);
        },
    });

    const deletePostMutation = useMutation({
        mutationFn: apiDeletePost,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['loungeFeed'] });
            setDeletingPostId(null);
        },
    });

    const patchReactionInFeed = (
        oldData: InfiniteData<LoungeFeedResponse> | undefined,
        postId: string,
        emoji: string,
        nextReactions?: Record<string, number>,
        nextUserReaction?: string | null,
    ): InfiniteData<LoungeFeedResponse> | undefined => {
        if (!oldData) return oldData;

        return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
                ...page,
                data: page.data.map((post) => {
                    if (post.id !== postId) return post;

                    if (nextReactions && nextUserReaction !== undefined) {
                        return {
                            ...post,
                            reactions: nextReactions,
                            userReaction: nextUserReaction,
                        };
                    }

                    const currentReaction = post.userReaction;
                    const reactions = { ...post.reactions };

                    if (currentReaction) {
                        reactions[currentReaction] = Math.max(
                            (reactions[currentReaction] || 0) - 1,
                            0,
                        );
                    }

                    const toggledOff = currentReaction === emoji;
                    if (!toggledOff) {
                        reactions[emoji] = (reactions[emoji] || 0) + 1;
                    }

                    return {
                        ...post,
                        reactions,
                        userReaction: toggledOff ? null : emoji,
                    };
                }),
            })),
        };
    };

    const reactMutation = useMutation({
        mutationFn: ({ postId, emoji }: { postId: string; emoji: string }) =>
            reactToPost(postId, emoji),
        onMutate: async ({ postId, emoji }) => {
            await queryClient.cancelQueries({ queryKey: ['loungeFeed'] });
            const snapshots = queryClient.getQueriesData<InfiniteData<LoungeFeedResponse>>({
                queryKey: ['loungeFeed'],
            });

            queryClient.setQueriesData<InfiniteData<LoungeFeedResponse>>(
                { queryKey: ['loungeFeed'] },
                (oldData) => patchReactionInFeed(oldData, postId, emoji),
            );

            return { snapshots };
        },
        onSuccess: (result, variables) => {
            queryClient.setQueriesData<InfiniteData<LoungeFeedResponse>>(
                { queryKey: ['loungeFeed'] },
                (oldData) =>
                    patchReactionInFeed(
                        oldData,
                        variables.postId,
                        variables.emoji,
                        result.reactions,
                        result.userReaction,
                    ),
            );
        },
        onError: (_error, _variables, context) => {
            context?.snapshots?.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data);
            });

            toast({
                title: 'Error',
                description: 'Failed to update reaction.',
                variant: 'destructive',
            });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['loungeFeed'] });
        },
    });

    // ─── Handlers ───

    const isPostOwner = (post: LoungePost) => post.authorId === user?.id;

    const handleReact = (postId: string, reaction: AcademicReaction) => {
        reactMutation.mutate({ postId, emoji: reaction });
    };

    const handlePost = (
        content: string | undefined,
        tag: PostTag,
        course?: string,
        isAnonymous?: boolean,
        imageDataUrl?: string,
        imageName?: string,
    ) => {
        toast
            .promise(
                createPostMutation.mutateAsync({
                    content,
                    tags: [tag],
                    course,
                    isAnonymous,
                    imageDataUrl,
                    imageName,
                }),
                {
                    loading: {
                        title: 'Posting',
                        description: 'Publishing your post...',
                    },
                    success: {
                        title: 'Posted!',
                        description: 'Your post is live.',
                    },
                    error: (error) => ({
                        title: 'Error',
                        description: getErrorMessage(error, 'Failed to create post.'),
                        variant: 'destructive',
                    }),
                },
            )
            .catch(() => {
                // handled by toast.promise
            });
    };

    const handleEditPost = (id: string, content: string, tag: PostTag) => {
        toast
            .promise(editPostMutation.mutateAsync({ id, content, tags: [tag] }), {
                loading: {
                    title: 'Updating Post',
                    description: 'Saving your edits...',
                },
                success: {
                    title: 'Updated!',
                    description: 'Your post has been edited.',
                },
                error: (error) => ({
                    title: 'Error',
                    description: getErrorMessage(error, 'Failed to edit post.'),
                    variant: 'destructive',
                }),
            })
            .catch(() => {
                // handled by toast.promise
            });
    };

    const handleDeletePost = () => {
        if (!deletingPostId) return;
        toast
            .promise(deletePostMutation.mutateAsync(deletingPostId), {
                loading: {
                    title: 'Deleting Post',
                    description: 'Removing your post...',
                },
                success: {
                    title: 'Deleted',
                    description: 'Post has been removed.',
                },
                error: (error) => ({
                    title: 'Error',
                    description: getErrorMessage(error, 'Failed to delete post.'),
                    variant: 'destructive',
                }),
            })
            .catch(() => {
                // handled by toast.promise
            });
    };

    // ─── Derived data ───

    // Client-side sorting for 'trending' and 'discussed' since backend currently orders by createdAt
    const sortedPosts = useMemo(() => {
        const result = [...posts];
        if (sortBy === 'trending') {
            result.sort((a, b) => {
                const totalA = Object.values(a.reactions).reduce((s, v) => s + v, 0) + a.replyCount;
                const totalB = Object.values(b.reactions).reduce((s, v) => s + v, 0) + b.replyCount;
                return totalB - totalA;
            });
        } else if (sortBy === 'discussed') {
            result.sort((a, b) => b.replyCount - a.replyCount);
        }
        return result;
    }, [posts, sortBy]);

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-3xl">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
                    Social
                </p>
                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">
                    The Lounge
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                    Anonymous academic feed · Be real, be kind
                </p>
            </div>

            {/* Compose */}
            <ComposeBox onPost={handlePost} isPending={createPostMutation.isPending} />

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
                        <span className="text-[10px] uppercase tracking-widest font-bold">
                            Feed
                        </span>
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

                    <CourseSelectDropdown
                        value={filterCourse}
                        onChange={setFilterCourse}
                        placeholder="All Courses"
                        className="w-[130px]"
                        semesterId={activeSemester?.id}
                        allowAll
                    />

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Newest
                                </span>
                            </SelectItem>
                            <SelectItem value="trending">
                                <span className="flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" /> Trending
                                </span>
                            </SelectItem>
                            <SelectItem value="discussed">
                                <span className="flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3" /> Most Discussed
                                </span>
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {(filterTag !== 'all' || filterCourse !== 'all' || search) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                                setFilterTag('all');
                                setFilterCourse('all');
                                setSearch('');
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
                        <div key={i} className="border border-border bg-card p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-14 bg-muted animate-pulse" />
                                <div className="h-4 w-10 bg-muted animate-pulse" />
                                <div className="flex-1" />
                                <div className="h-3 w-12 bg-muted animate-pulse" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="h-3.5 w-full bg-muted animate-pulse" />
                                <div className="h-3.5 w-2/3 bg-muted animate-pulse" />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-6 w-12 bg-muted animate-pulse" />
                                <div className="h-6 w-12 bg-muted animate-pulse" />
                                <div className="h-6 w-16 bg-muted animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : sortedPosts.length === 0 ? (
                <div className="border border-dashed border-muted-foreground/30 p-12 flex flex-col items-center gap-2">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm uppercase tracking-wider text-muted-foreground">
                        No posts yet
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                        Be the first to break the silence
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedPosts.map((post, idx) => (
                        <div
                            key={post.id}
                            ref={idx === sortedPosts.length - 1 ? lastPostRef : undefined}
                        >
                            <PostCard
                                post={post}
                                isOwner={isPostOwner(post)}
                                isAdmin={isAdmin}
                                onReact={handleReact}
                                reactPending={reactMutation.isPending}
                                onEdit={() => setEditingPost(post)}
                                onDelete={() => setDeletingPostId(post.id)}
                            />
                        </div>
                    ))}
                    {isFetchingNextPage && (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    )}
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

            {/* Edit Post Dialog */}
            <EditPostDialog
                post={editingPost}
                open={!!editingPost}
                onOpenChange={(open) => !open && setEditingPost(null)}
                onSave={handleEditPost}
                isPending={editPostMutation.isPending}
            />

            {/* Delete Post Confirmation */}
            <AlertDialog
                open={!!deletingPostId}
                onOpenChange={(open) => !open && setDeletingPostId(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Post</AlertDialogTitle>
                        <AlertDialogDescription>
                            This post will be permanently removed. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeletePost}
                            disabled={deletePostMutation.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deletePostMutation.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Lounge;
