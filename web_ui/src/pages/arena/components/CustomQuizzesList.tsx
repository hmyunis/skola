import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Flag,
  Loader2,
  Play,
  Search,
  Shield,
  Trash2,
  User,
  UserCheck,
} from "lucide-react";
import {
  deleteArenaQuiz,
  fetchArenaQuiz,
  fetchArenaQuizzes,
  type CustomQuiz,
} from "@/services/arena";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CourseSelectDropdown } from "@/components/CourseSelectDropdown";
import { ReportDialog } from "@/components/ReportDialog";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/stores/authStore";
import { getArenaCourseLabel, getErrorMessage, toArenaCourseCode } from "../utils";

interface CustomQuizzesListProps {
  onPlay: (quiz: CustomQuiz) => void;
}

export function CustomQuizzesList({ onPlay }: CustomQuizzesListProps) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [deletingQuiz, setDeletingQuiz] = useState<CustomQuiz | null>(null);
  const [reportQuiz, setReportQuiz] = useState<CustomQuiz | null>(null);
  const [quizSearchInput, setQuizSearchInput] = useState("");
  const [quizSearch, setQuizSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [courseFilterName, setCourseFilterName] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setQuizSearch(quizSearchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [quizSearchInput]);

  const quizzesQuery = useInfiniteQuery({
    queryKey: ["arenaQuizzes", quizSearch, courseFilter],
    queryFn: ({ pageParam = 1 }) =>
      fetchArenaQuizzes({
        page: pageParam,
        limit: 20,
        search: quizSearch || undefined,
        course: courseFilter !== "all" ? courseFilter : undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.lastPage ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  const quizzes = quizzesQuery.data?.pages.flatMap((page) => page.data) || [];
  const isFetchingMoreQuizzes = quizzesQuery.isFetchingNextPage;
  const hasMoreQuizzes = quizzesQuery.hasNextPage;
  const fetchMoreQuizzes = quizzesQuery.fetchNextPage;

  const deleteMutation = useMutation({
    mutationFn: (quizId: string) => deleteArenaQuiz(quizId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arenaQuizzes"] });
      toast({ title: "Deleted", description: "Quiz has been removed." });
      setDeletingQuiz(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Delete Failed",
        description: getErrorMessage(error, "Could not delete quiz."),
        variant: "destructive",
      });
    },
  });

  const playMutation = useMutation({
    mutationFn: (quizId: string) => fetchArenaQuiz(quizId),
    onSuccess: (quiz) => onPlay(quiz),
    onError: (error: unknown) => {
      toast({
        title: "Could Not Open Quiz",
        description: getErrorMessage(error, "Try again."),
        variant: "destructive",
      });
    },
  });

  const lastQuizRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingMoreQuizzes) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreQuizzes) {
          fetchMoreQuizzes();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [isFetchingMoreQuizzes, hasMoreQuizzes, fetchMoreQuizzes],
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  const hasQuizFilters = Boolean(quizSearch) || courseFilter !== "all";
  if (!quizzesQuery.isLoading && quizzes.length === 0 && !hasQuizFilters) return null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Community Quizzes</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={quizSearchInput}
              onChange={(event) => setQuizSearchInput(event.target.value)}
              placeholder="Search quizzes, course, author..."
              className="pl-8 h-9 text-xs"
            />
          </div>
          <CourseSelectDropdown
            value={courseFilter}
            onChange={(value, selectedCourse) => {
              if (value === "all") {
                setCourseFilter("all");
                setCourseFilterName("");
                return;
              }
              const nextCourse = toArenaCourseCode(value, selectedCourse);
              if (nextCourse === null) {
                toast({
                  title: "Course Code Required",
                  description: "Arena quizzes need a coded course.",
                  variant: "destructive",
                });
                return;
              }
              if (!nextCourse) {
                setCourseFilter("all");
                setCourseFilterName("");
                return;
              }
              setCourseFilter(nextCourse);
              setCourseFilterName(selectedCourse?.name?.trim() || "");
            }}
            placeholder="All courses"
            allowAll
            className="w-full sm:w-[220px] h-9 text-xs"
            selectedLabel={courseFilter !== "all" ? getArenaCourseLabel(courseFilter, courseFilterName) : undefined}
          />
        </div>

        {quizzesQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {quizzes.length === 0 ? (
              <div className="border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No quizzes match the current filters.
              </div>
            ) : (
              quizzes.map((quiz, idx) => (
                <div
                  key={quiz.id}
                  ref={idx === quizzes.length - 1 ? lastQuizRef : undefined}
                  className="border border-border bg-card p-3 flex flex-col gap-3 sm:flex-row sm:items-center hover:bg-card transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold break-words leading-relaxed">{quiz.title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{quiz.course}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{quiz.questionCount} Q</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className={cn(
                        "text-[10px] tabular-nums",
                        quiz.canAttempt ? "text-muted-foreground" : "text-destructive"
                      )}>
                        {quiz.attemptsRemaining}/{quiz.maxAttempts} attempts left
                      </span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
                        {quiz.anonymous_id.startsWith("Anon#") ? (
                          <User className="h-2.5 w-2.5" />
                        ) : (
                          <UserCheck className="h-2.5 w-2.5 text-primary" />
                        )}
                        <span className={cn("break-words", !quiz.anonymous_id.startsWith("Anon#") && "text-foreground font-medium")}>
                          {quiz.anonymous_id}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto sm:shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs flex-1 sm:flex-none"
                      onClick={() => playMutation.mutate(quiz.id)}
                      disabled={playMutation.isPending || !quiz.canAttempt}
                    >
                      {playMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      {quiz.canAttempt ? "Play" : "No Attempts Left"}
                    </Button>
                    {!quiz.createdByUser && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => setReportQuiz(quiz)}
                          >
                            <Flag className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><span>Report quiz</span></TooltipContent>
                      </Tooltip>
                    )}
                    {(quiz.createdByUser || isAdmin) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn("h-8 w-8 p-0 shrink-0", quiz.createdByUser ? "text-destructive hover:text-destructive" : "text-amber-500 hover:text-destructive")}
                            onClick={() => setDeletingQuiz(quiz)}
                          >
                            {quiz.createdByUser ? <Trash2 className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><span>{quiz.createdByUser ? "Delete quiz" : "Delete quiz (admin)"}</span></TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              ))
            )}
            {quizzesQuery.isFetchingNextPage && quizzes.length > 0 && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={!!deletingQuiz} onOpenChange={(open) => !open && setDeletingQuiz(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription>This quiz will be permanently removed. Continue?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingQuiz && deleteMutation.mutate(deletingQuiz.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {reportQuiz && (
        <ReportDialog
          open={!!reportQuiz}
          onOpenChange={(open) => !open && setReportQuiz(null)}
          contentType="quiz"
          contentId={reportQuiz.id}
          contentPreview={reportQuiz.title + " (" + reportQuiz.questionCount + " questions)"}
          contentAuthor={reportQuiz.anonymous_id}
        />
      )}
    </>
  );
}
