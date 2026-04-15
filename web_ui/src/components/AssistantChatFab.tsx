import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Info,
  KeyRound,
  Loader2,
  MessageSquarePlus,
  Minimize2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import {
  fetchAssistantSuggestions,
  sendAssistantMessage,
  type AssistantHistoryMessage,
} from "@/services/assistant";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ChatMessage = AssistantHistoryMessage & {
  id: string;
  createdAt: number;
  cached?: boolean;
  sources?: string[];
  error?: boolean;
};

const LOADING_FEELS = [
  "Thinking with your latest classroom data...",
  "Scanning upcoming assessments...",
  "Checking announcement priorities...",
  "Compressing context for token efficiency...",
  "Reviewing course-level signals...",
  "Reviewing recent classroom activity...",
  "Indexing resource metadata...",
  "Aligning with semester scope...",
  "Building a concise response plan...",
  "Running a quick relevance pass...",
  "Cross-checking due dates and status...",
  "Ranking the most useful snippets...",
  "Trimming noisy details...",
  "Grounding answer in classroom facts...",
  "Preparing citations from context...",
  "Balancing speed with detail...",
  "Reducing duplicate evidence...",
  "Shaping action-oriented guidance...",
  "Finalizing a safe response...",
  "Polishing answer clarity...",
];

type MarkdownBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; code: string; language: string | null };

function randomLoaderIndex() {
  return Math.floor(Math.random() * LOADING_FEELS.length);
}

function toHistory(messages: ChatMessage[]): AssistantHistoryMessage[] {
  return messages
    .slice(-10)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content,
    }))
    .filter((item) => item.content.trim().length > 0);
}

function formatMessageTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildClientTimeContext() {
  let clientTimeZone: string | undefined;
  let clientLocale: string | undefined;

  try {
    const options = Intl.DateTimeFormat().resolvedOptions();
    clientTimeZone = options.timeZone || undefined;
    clientLocale =
      options.locale ||
      (typeof navigator !== "undefined" ? navigator.language : undefined);
  } catch {
    clientLocale = typeof navigator !== "undefined" ? navigator.language : undefined;
  }

  return {
    clientTimeZone,
    clientLocale,
    clientNowIso: new Date().toISOString(),
  };
}

function buildInitials(name: string | null | undefined) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia(`(max-width: ${breakpoint - 0.02}px)`);
    const apply = (matches: boolean) => setIsMobile(matches);
    apply(query.matches);

    const onChange = (event: MediaQueryListEvent) => apply(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const codeFence = trimmed.match(/^```([\w-]+)?\s*$/);
    if (codeFence) {
      const language = codeFence[1] ? codeFence[1].trim() : null;
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ kind: "code", code: codeLines.join("\n"), language });
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        text: heading[2].trim(),
      });
      i += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, "").trim());
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("```")
    ) {
      paragraphLines.push(lines[i].trimEnd());
      i += 1;
    }
    blocks.push({ kind: "paragraph", lines: paragraphLines });
  }

  return blocks;
}

function transformInlineNodes(
  nodes: Array<string | JSX.Element>,
  regex: RegExp,
  makeNode: (match: RegExpExecArray, key: string) => JSX.Element,
  keyPrefix: string,
) {
  const next: Array<string | JSX.Element> = [];
  nodes.forEach((node, nodeIndex) => {
    if (typeof node !== "string") {
      next.push(node);
      return;
    }

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;

    while ((match = regex.exec(node)) !== null) {
      if (match.index > lastIndex) {
        next.push(node.slice(lastIndex, match.index));
      }
      next.push(makeNode(match, `${keyPrefix}-${nodeIndex}-${match.index}`));
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < node.length) {
      next.push(node.slice(lastIndex));
    }
  });

  return next;
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  let nodes: Array<string | JSX.Element> = [text];

  nodes = transformInlineNodes(
    nodes,
    /`([^`]+)`/g,
    (match, key) => (
      <code key={key} className="px-1 py-0.5 text-[11px] bg-secondary/80 border border-border">
        {match[1]}
      </code>
    ),
    `${keyPrefix}-code`,
  );

  nodes = transformInlineNodes(
    nodes,
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (match, key) => (
      <a
        key={key}
        href={match[2]}
        target="_blank"
        rel="noreferrer"
        className="underline text-primary hover:text-primary/80"
      >
        {match[1]}
      </a>
    ),
    `${keyPrefix}-link`,
  );

  nodes = transformInlineNodes(
    nodes,
    /\*\*([^*]+)\*\*|__([^_]+)__/g,
    (match, key) => <strong key={key}>{match[1] || match[2]}</strong>,
    `${keyPrefix}-strong`,
  );

  nodes = transformInlineNodes(
    nodes,
    /\*([^*]+)\*|_([^_]+)_/g,
    (match, key) => <em key={key}>{match[1] || match[2]}</em>,
    `${keyPrefix}-em`,
  );

  return nodes;
}

function renderAssistantMarkdownBlocks(blocks: MarkdownBlock[], keyPrefix: string) {
  return blocks.map((block, index) => {
    const key = `${keyPrefix}-block-${index}`;
    if (block.kind === "heading") {
      const HeadingTag = (`h${Math.min(block.level, 4)}` as unknown) as
        | "h1"
        | "h2"
        | "h3"
        | "h4";
      return (
        <HeadingTag key={key} className="font-semibold whitespace-pre-wrap">
          {renderInlineMarkdown(block.text, key)}
        </HeadingTag>
      );
    }

    if (block.kind === "code") {
      return (
        <pre key={key} className="mt-1 overflow-x-auto border border-border bg-secondary/70 p-2 text-[11px]">
          <code>{block.code}</code>
        </pre>
      );
    }

    if (block.kind === "ul") {
      return (
        <ul key={key} className="list-disc pl-4 space-y-0.5">
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-item-${itemIndex}`} className="whitespace-pre-wrap">
              {renderInlineMarkdown(item, `${key}-item-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
    }

    if (block.kind === "ol") {
      return (
        <ol key={key} className="list-decimal pl-4 space-y-0.5">
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-item-${itemIndex}`} className="whitespace-pre-wrap">
              {renderInlineMarkdown(item, `${key}-item-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
    }

    return (
      <p key={key} className="whitespace-pre-wrap leading-relaxed">
        {block.lines.map((line, lineIndex) => (
          <span key={`${key}-line-${lineIndex}`}>
            {lineIndex > 0 ? <br /> : null}
            {renderInlineMarkdown(line, `${key}-line-${lineIndex}`)}
          </span>
        ))}
      </p>
    );
  });
}

const AssistantMarkdownContent = memo(function AssistantMarkdownContent({
  content,
  messageId,
}: {
  content: string;
  messageId: string;
}) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  return <div className="space-y-1">{renderAssistantMarkdownBlocks(blocks, messageId)}</div>;
});

export function AssistantChatFab() {
  const { user } = useAuth();
  const activeClassroomId = useClassroomStore((s) => s.activeClassroom?.id);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [quickPromptsCollapsed, setQuickPromptsCollapsed] = useState(true);
  const [expandedSourcesByMessageId, setExpandedSourcesByMessageId] = useState<
    Record<string, boolean>
  >({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaderIndex, setLoaderIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const chatSessionRef = useRef(0);

  const suggestionsQuery = useQuery({
    queryKey: ["assistant-suggestions", activeClassroomId],
    queryFn: fetchAssistantSuggestions,
    enabled: open && !!activeClassroomId,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    const incoming = suggestionsQuery.data?.suggestions || [];
    if (incoming.length > 0 && messages.length === 0) {
      setSuggestions(incoming.slice(0, 8));
    }
  }, [suggestionsQuery.data?.suggestions, messages.length]);

  const resetConversation = (silent = false) => {
    chatSessionRef.current += 1;
    setInput("");
    setMessages([]);
    setExpandedSourcesByMessageId({});
    setQuickPromptsCollapsed(true);
    const seedSuggestions = suggestionsQuery.data?.suggestions || [];
    setSuggestions(seedSuggestions.length ? seedSuggestions.slice(0, 8) : []);
    if (!silent) {
      toast({
        title: "Started new chat",
        description: "Previous assistant messages were cleared.",
      });
    }
  };

  useEffect(() => {
    chatSessionRef.current += 1;
    setOpen(false);
    setInput("");
    setMessages([]);
    setSuggestions([]);
    setExpandedSourcesByMessageId({});
    setQuickPromptsCollapsed(true);
  }, [activeClassroomId]);

  const chatMutation = useMutation({
    mutationFn: (payload: {
      message: string;
      history?: AssistantHistoryMessage[];
      clientTimeZone?: string;
      clientLocale?: string;
      clientNowIso?: string;
      clientSessionId: number;
    }) =>
      sendAssistantMessage({
        message: payload.message,
        history: payload.history,
        clientTimeZone: payload.clientTimeZone,
        clientLocale: payload.clientLocale,
        clientNowIso: payload.clientNowIso,
      }),
    onSuccess: (data, variables) => {
      if (variables.clientSessionId !== chatSessionRef.current) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: "assistant",
          content: data.answer,
          createdAt: Date.now(),
          cached: data.cached,
          sources: data.sources,
        },
      ]);
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions.slice(0, 8));
      }
    },
    onError: (error: unknown, variables) => {
      if (variables.clientSessionId !== chatSessionRef.current) return;
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Assistant request failed. Please try again.";
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: message,
          createdAt: Date.now(),
          error: true,
        },
      ]);
      toast({
        title: "Assistant failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!chatMutation.isPending) return;
    setLoaderIndex(randomLoaderIndex());
    const timer = window.setInterval(() => {
      setLoaderIndex((prev) => (prev + 1) % LOADING_FEELS.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [chatMutation.isPending]);

  useEffect(() => {
    if (!open) return;
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages, chatMutation.isPending]);

  const canUseAssistant = Boolean(user && activeClassroomId);
  const canSend = input.trim().length > 0 && !chatMutation.isPending;
  const visibleSuggestions = useMemo(() => suggestions.slice(0, 6), [suggestions]);

  const submitMessage = (raw?: string) => {
    const nextValue = String(raw ?? input).trim();
    if (!nextValue || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: "user",
      content: nextValue,
      createdAt: Date.now(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    const timeContext = buildClientTimeContext();
    chatMutation.mutate({
      message: nextValue,
      history: toHistory(nextMessages),
      clientTimeZone: timeContext.clientTimeZone,
      clientLocale: timeContext.clientLocale,
      clientNowIso: timeContext.clientNowIso,
      clientSessionId: chatSessionRef.current,
    });
  };

  const toggleMessageSources = (messageId: string) => {
    setExpandedSourcesByMessageId((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  if (!canUseAssistant) return null;

  const assistantPanel = (
    <div
      className={cn(
        "border border-border bg-card shadow-xl",
        isMobile ? "h-full flex flex-col border-b-0 rounded-t-2xl" : "w-[min(94vw,24rem)]",
      )}
    >
      {isMobile && <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-border" aria-hidden="true" />}

      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider truncate">Classroom Assistant</p>
            <p className="text-[10px] text-muted-foreground truncate">Gemini 2.5 · BYOK required</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate("/settings?tab=byok")}
            className="inline-flex h-7 items-center gap-1 border border-border px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Open BYOK settings"
          >
            <KeyRound className="h-3 w-3" />
            BYOK
          </button>
          <button
            type="button"
            onClick={() => resetConversation()}
            className="inline-flex h-7 items-center gap-1 border border-border px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Start a new chat"
          >
            <MessageSquarePlus className="h-3 w-3" />
            New
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            title="Collapse assistant"
            aria-label="Collapse assistant"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className={cn(
          "overflow-y-auto px-3 py-2 space-y-2 bg-background/50",
          isMobile ? "flex-1 min-h-0" : "h-[20.5rem]",
        )}
      >
        {messages.length === 0 && (
          <div className="border border-dashed border-border p-2.5 text-xs text-muted-foreground">
            Ask about announcements, resources, courses, schedules, quizzes, and upcoming assessments.
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex items-start gap-2",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {message.role === "assistant" && (
              <div className="h-7 w-7 shrink-0 rounded-full border border-border bg-secondary/70 text-muted-foreground flex items-center justify-center">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[82%] border px-2.5 py-2 text-xs break-words",
                message.role === "user"
                  ? "border-primary/40 bg-primary/10"
                  : message.error
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border bg-card",
              )}
            >
              {message.role === "assistant" && !message.error ? (
                <AssistantMarkdownContent content={message.content} messageId={message.id} />
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[10px] text-muted-foreground">
                  {formatMessageTimestamp(message.createdAt)}
                </p>
                {message.role === "assistant" &&
                  Array.isArray(message.sources) &&
                  message.sources.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleMessageSources(message.id)}
                      className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={
                        expandedSourcesByMessageId[message.id]
                          ? "Hide sources"
                          : "Show sources"
                      }
                      title={
                        expandedSourcesByMessageId[message.id]
                          ? "Hide sources"
                          : "Show sources"
                      }
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  )}
              </div>
              {message.role === "assistant" && message.cached && (
                <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                  Cached answer
                </p>
              )}
              {message.role === "assistant" &&
                Array.isArray(message.sources) &&
                message.sources.length > 0 &&
                expandedSourcesByMessageId[message.id] && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Sources: {message.sources.join(" | ")}
                  </p>
                )}
            </div>
            {message.role === "user" && (
              <div className="h-7 w-7 shrink-0 rounded-full border border-border bg-primary/15 text-primary flex items-center justify-center overflow-hidden">
                {user?.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user?.name || "You"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-semibold">
                    {user?.initials || buildInitials(user?.name)}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex items-start gap-2">
            <div className="h-7 w-7 shrink-0 rounded-full border border-border bg-secondary/70 text-muted-foreground flex items-center justify-center">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="max-w-[82%] border border-border bg-card px-2.5 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="font-semibold">Thinking...</span>
              </div>
              <p className="mt-1">{LOADING_FEELS[loaderIndex]}</p>
            </div>
          </div>
        )}
      </div>

      {visibleSuggestions.length > 0 && (
        <div className="border-t border-border px-2 py-2">
          <button
            type="button"
            onClick={() => setQuickPromptsCollapsed((prev) => !prev)}
            className="w-full mb-1 inline-flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            aria-expanded={!quickPromptsCollapsed}
            aria-label={quickPromptsCollapsed ? "Expand quick prompts" : "Collapse quick prompts"}
          >
            <span>Quick prompts</span>
            {quickPromptsCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
          {!quickPromptsCollapsed && (
            <div className="flex flex-wrap gap-1.5">
              {visibleSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitMessage(prompt)}
                  disabled={chatMutation.isPending}
                  className="border border-border bg-card px-2 py-1 text-[10px] text-left text-foreground hover:bg-accent disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "border-t border-border p-2",
          isMobile && "pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]",
        )}
      >
        <div className="flex items-center gap-1.5">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitMessage();
              }
            }}
            placeholder="Ask about this classroom..."
            className="h-9 flex-1 border border-input bg-background px-2 text-xs outline-none focus:border-ring"
            disabled={chatMutation.isPending}
          />
          <button
            type="button"
            onClick={() => submitMessage()}
            disabled={!canSend}
            className="inline-flex h-9 w-9 items-center justify-center border border-primary/40 bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Send assistant message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "fixed right-4 z-40 h-12 w-12 border border-primary/40 bg-primary text-primary-foreground shadow-lg transition-all",
          "hover:brightness-110",
          isMobile
            ? "bottom-16"
            : open
              ? "bottom-[25.5rem] md:bottom-[24.5rem]"
              : "bottom-16 md:bottom-5",
        )}
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {open ? <X className="mx-auto h-5 w-5" /> : <Bot className="mx-auto h-5 w-5" />}
      </button>

      {open && !isMobile && (
        <div className="fixed right-4 bottom-16 md:bottom-5 z-40">
          {assistantPanel}
        </div>
      )}

      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="z-50 md:hidden h-[82vh] max-h-[82vh] p-0 border-t border-border bg-transparent [&>button]:hidden"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Classroom Assistant</SheetTitle>
              <SheetDescription>
                Ask questions about your classroom and get student-friendly guidance.
              </SheetDescription>
            </SheetHeader>
            {assistantPanel}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
