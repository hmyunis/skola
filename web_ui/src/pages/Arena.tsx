import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createArenaQuiz,
  deleteArenaQuiz,
  fetchArenaQuiz,
  fetchArenaQuizzes,
  fetchArenaStats,
  fetchLeaderboard,
  fetchRandomQuizByCourse,
  submitArenaAttempt,
  type ArenaPlayerStats,
  type CustomQuiz,
  type LeaderboardEntry,
  type QuizQuestion,
} from "@/services/arena";
import { COURSES } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Swords,
  Trophy,
  Flame,
  Target,
  Zap,
  Crown,
  Medal,
  Timer,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Search,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Play,
  BookOpen,
  Shield,
  User,
  UserCheck,
  Flag,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/stores/authStore";
import { useFeatureEnabled } from "@/services/features";
import { toast } from "@/hooks/use-toast";
import { ReportDialog } from "@/components/ReportDialog";

const DEFAULT_PLAYER_STATS: ArenaPlayerStats = {
  xp: 0,
  wins: 0,
  totalPlayed: 0,
  streak: 0,
  bestStreak: 0,
  correctAnswers: 0,
  totalAnswers: 0,
  accuracy: 0,
  title: "Rookie",
};

function getTitle(xp: number): string {
  if (xp >= 2000) return "Legend";
  if (xp >= 1000) return "Champion";
  if (xp >= 500) return "Strategist";
  if (xp >= 200) return "Scholar";
  return "Rookie";
}

const difficultyXp = { easy: 10, medium: 20, hard: 30 };

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
  return <span className="text-xs font-black tabular-nums text-muted-foreground">#{rank}</span>;
}

function Leaderboard({
  data,
  lastItemRef,
}: {
  data: LeaderboardEntry[];
  lastItemRef?: (node: HTMLDivElement | null) => void;
}) {
  const { user } = useAuth();
  const currentAnonId = user?.anonymousId || user?.anonymous_id;

  return (
    <div className="border border-border overflow-x-auto">
      <div className="min-w-[400px]">
        <div className="grid grid-cols-[36px_1fr_56px_44px_56px] sm:grid-cols-[48px_1fr_80px_64px_64px_80px] gap-1 px-3 py-2 bg-muted/50 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">XP</span>
          <span className="text-right">Wins</span>
          <span className="text-right hidden sm:block">Acc%</span>
          <span className="text-right">Streak</span>
        </div>
        {data.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No players match your search</div>
        ) : (
          data.map((entry, idx) => {
            const isCurrentUser = currentAnonId === entry.anonymous_id;
            const isLast = idx === data.length - 1;
            return (
              <div
                key={`${entry.rank}-${entry.anonymous_id}`}
                ref={isLast ? lastItemRef : undefined}
                className={cn(
                  "grid grid-cols-[36px_1fr_56px_44px_56px] sm:grid-cols-[48px_1fr_80px_64px_64px_80px] gap-1 px-3 py-2.5 border-b border-border last:border-b-0 items-center",
                  isCurrentUser
                    ? "bg-primary/10 border-l-2 border-l-primary"
                    : entry.rank <= 3 && "bg-accent/30"
                )}
              >
                <div className="flex items-center justify-center">
                  <RankIcon rank={entry.rank} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">
                    {entry.anonymous_id}
                    {isCurrentUser && (
                      <span className="ml-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">(You)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{entry.title}</p>
                </div>
                <p className="text-xs font-black tabular-nums text-right">{entry.xp.toLocaleString()}</p>
                <p className="text-xs tabular-nums text-right text-muted-foreground">{entry.wins}</p>
                <p className="text-xs tabular-nums text-right text-muted-foreground hidden sm:block">{entry.accuracy}%</p>
                <div className="flex items-center justify-end gap-1">
                  {entry.streak > 0 && <Flame className="h-3 w-3 text-amber-500" />}
                  <span className="text-xs tabular-nums font-medium">{entry.streak}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

type QuizState = "idle" | "playing" | "submitting" | "result";

function QuizBattle({
  onUpdateStats,
  customQuiz,
}: {
  onUpdateStats: (stats: ArenaPlayerStats) => void;
  customQuiz?: CustomQuiz | null;
}) {
  const [course, setCourse] = useState("CS301");
  const [state, setState] = useState<QuizState>("idle");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [xpEarned, setXpEarned] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [resultWon, setResultWon] = useState(false);

  const currentQ = questions[currentIdx];
  const currentDuration = currentQ?.durationSeconds || 15;

  useEffect(() => {
    if (!customQuiz?.questions?.length) return;
    setQuestions(customQuiz.questions);
    setActiveQuizId(customQuiz.id);
    setCourse(customQuiz.course);
    setCurrentIdx(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setCorrectCount(0);
    setTimeLeft(customQuiz.questions[0]?.durationSeconds || 15);
    setXpEarned(0);
    setAnswers([]);
    setResultWon(false);
    setState("playing");
  }, [customQuiz]);

  useEffect(() => {
    if (!currentQ || state !== "playing" || answered) return;
    setTimeLeft(currentQ.durationSeconds || 15);
  }, [currentIdx, currentQ, state, answered]);

  const startQuiz = useCallback(async () => {
    try {
      const quiz = await fetchRandomQuizByCourse(course);
      if (!quiz.questions?.length) {
        toast({ title: "No Quiz Found", description: "No questions available for this course.", variant: "destructive" });
        return;
      }
      setQuestions(quiz.questions);
      setActiveQuizId(quiz.id);
      setCurrentIdx(0);
      setSelected(null);
      setAnswered(false);
      setScore(0);
      setCorrectCount(0);
      setTimeLeft(quiz.questions[0]?.durationSeconds || 15);
      setXpEarned(0);
      setAnswers([]);
      setResultWon(false);
      setState("playing");
    } catch (error: unknown) {
      toast({
        title: "Could Not Start Quiz",
        description: getErrorMessage(error, "Try another subject or create a quiz first."),
        variant: "destructive",
      });
    }
  }, [course]);

  useEffect(() => {
    if (state !== "playing" || answered || !currentQ) return;
    if (timeLeft <= 0) {
      setAnswers((prev) => {
        const next = [...prev];
        next[currentIdx] = currentQ.options.length;
        return next;
      });
      setAnswered(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [state, timeLeft, answered, currentIdx, currentQ]);

  const handleAnswer = (idx: number) => {
    if (answered || !currentQ) return;
    setSelected(idx);
    setAnswered(true);
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIdx] = idx;
      return next;
    });
    if (idx === currentQ.correctIndex) {
      const pts = difficultyXp[currentQ.difficulty];
      setScore((p) => p + pts);
      setCorrectCount((p) => p + 1);
      setXpEarned((p) => p + pts);
    }
  };

  const finishQuiz = async () => {
    if (!activeQuizId || !questions.length) {
      setState("result");
      return;
    }

    const normalizedAnswers = questions.map((question, index) => {
      const answer = answers[index];
      return answer === undefined ? question.options.length : answer;
    });

    setState("submitting");
    try {
      const result = await submitArenaAttempt(activeQuizId, normalizedAnswers);
      setCorrectCount(result.correctAnswers);
      setXpEarned(result.xpEarned);
      setScore(result.score);
      setResultWon(result.won);
      onUpdateStats(result.stats);
      setState("result");
    } catch (error: unknown) {
      toast({
        title: "Could Not Submit Attempt",
        description: getErrorMessage(error, "Result could not be saved."),
        variant: "destructive",
      });
      const won = correctCount >= Math.ceil(questions.length / 2);
      setResultWon(won);
      setState("result");
    }
  };

  const nextQuestion = () => {
    if (currentIdx + 1 >= questions.length) {
      void finishQuiz();
      return;
    }
    setCurrentIdx((p) => p + 1);
    setSelected(null);
    setAnswered(false);
  };

  const courseName = COURSES.find((c) => c.code === course)?.name || course;

  if (state === "idle") {
    return (
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <h3 className="font-bold uppercase tracking-wider text-sm">Start a Quiz Battle</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            5+ questions - timed per question - Earn XP based on difficulty
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Subject</p>
              <Select value={course} onValueChange={setCourse}>
                <SelectTrigger className="w-[200px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURSES.filter((c) => ["CS301", "CS302", "CS303", "CS304"].includes(c.code)).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={startQuiz}>
              <Swords className="h-3 w-3" />
              Battle
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state === "submitting") {
    return (
      <Card className="border-2 border-primary/30">
        <CardContent className="p-8 flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Submitting your result...</p>
        </CardContent>
      </Card>
    );
  }

  if (state === "result") {
    const won = resultWon;
    const accuracy = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    return (
      <Card className={cn("border-2", won ? "border-emerald-500/50" : "border-destructive/50")}>
        <CardContent className="p-5 space-y-4 text-center">
          <div className="space-y-2">
            {won ? (
              <Trophy className="h-10 w-10 text-amber-500 mx-auto" />
            ) : (
              <XCircle className="h-10 w-10 text-destructive mx-auto" />
            )}
            <h3 className="text-xl font-black uppercase tracking-wider">
              {won ? "Victory!" : "Defeated"}
            </h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{courseName}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Score</p>
              <p className="text-2xl font-black tabular-nums">{correctCount}/{questions.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Accuracy</p>
              <p className="text-2xl font-black tabular-nums">{accuracy}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-primary">XP Earned</p>
              <p className="text-2xl font-black tabular-nums text-primary">+{xpEarned}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-2 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setState("idle")}>
              <RotateCcw className="h-3 w-3" />
              New Battle
            </Button>
            <Button className="w-full sm:w-auto" onClick={startQuiz}>
              <Swords className="h-3 w-3" />
              Rematch
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentQ) return null;

  const progress = ((currentIdx + (answered ? 1 : 0)) / questions.length) * 100;
  const timerPct = (timeLeft / currentDuration) * 100;

  return (
    <Card className="border-2 border-primary/30">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Q{currentIdx + 1}/{questions.length}
            </span>
            <span className={cn(
              "px-1.5 py-0.5 border text-[10px] font-bold uppercase tracking-wider",
              currentQ.difficulty === "easy" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" :
              currentQ.difficulty === "medium" ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
              "bg-destructive/10 text-destructive border-destructive/30"
            )}>
              {currentQ.difficulty}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Timer className={cn("h-4 w-4", timeLeft <= 5 ? "text-destructive animate-pulse" : "text-muted-foreground")} />
            <span className={cn("text-sm font-black tabular-nums", timeLeft <= 5 && "text-destructive")}>
              {timeLeft}s
            </span>
          </div>
        </div>

        <Progress value={progress} className="h-1.5" />

        <div className="h-1 bg-muted overflow-hidden">
          <div
            className={cn("h-full transition-all duration-1000 linear", timeLeft <= 5 ? "bg-destructive" : "bg-primary")}
            style={{ width: `${timerPct}%` }}
          />
        </div>

        <p className="text-sm font-bold leading-relaxed py-2">{currentQ.question}</p>

        <div className="space-y-2">
          {currentQ.options.map((opt, idx) => {
            const isCorrect = idx === currentQ.correctIndex;
            const isSelected = idx === selected;
            let optionClass = "border border-border hover:bg-accent/50 cursor-pointer";

            if (answered) {
              if (isCorrect) {
                optionClass = "border-2 border-emerald-500 bg-emerald-500/10";
              } else if (isSelected && !isCorrect) {
                optionClass = "border-2 border-destructive bg-destructive/10";
              } else {
                optionClass = "border border-border opacity-50";
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={answered}
                className={cn("w-full text-left p-3 flex items-center gap-3 transition-all", optionClass)}
              >
                <span className="h-6 w-6 shrink-0 flex items-center justify-center border border-current text-[10px] font-black">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-sm flex-1">{opt}</span>
                {answered && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                {answered && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="flex justify-between items-center pt-2">
            <p className="text-xs font-medium">
              {selected === currentQ.correctIndex ? (
                <span className="text-emerald-600">+{difficultyXp[currentQ.difficulty]} XP</span>
              ) : (
                <span className="text-destructive">No XP</span>
              )}
            </p>
            <Button size="sm" onClick={nextQuestion}>
              {currentIdx + 1 >= questions.length ? "See Results" : "Next"}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DraftQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  difficulty: "easy" | "medium" | "hard";
  durationSeconds: number;
}

const emptyDraftQuestion = (): DraftQuestion => ({
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  difficulty: "medium",
  durationSeconds: 15,
});
function CreateQuizDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { userName } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("CS301");
  const anonEnabled = useFeatureEnabled("ft-anon-posting");
  const [isAnonymous, setIsAnonymous] = useState(anonEnabled);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyDraftQuestion()]);
  const [currentQ, setCurrentQ] = useState(0);

  useEffect(() => {
    if (!anonEnabled) setIsAnonymous(false);
  }, [anonEnabled]);

  const createMutation = useMutation({
    mutationFn: createArenaQuiz,
    onSuccess: (quiz) => {
      queryClient.invalidateQueries({ queryKey: ["arenaQuizzes"] });
      toast({ title: "Quiz Created!", description: `"${quiz.title}" with ${quiz.questionCount} questions.` });
      resetForm();
      onOpenChange(false);
      onCreated();
    },
    onError: (error: unknown) => {
      toast({
        title: "Create Failed",
        description: getErrorMessage(error, "Could not create quiz."),
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTitle("");
    setCourse("CS301");
    setIsAnonymous(anonEnabled);
    setQuestions([emptyDraftQuestion()]);
    setCurrentQ(0);
  };

  const updateQuestion = (idx: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = [...q.options] as [string, string, string, string];
        newOpts[optIdx] = value;
        return { ...q, options: newOpts };
      })
    );
  };

  const addQuestion = () => {
    if (questions.length >= 20) return;
    setQuestions((prev) => [...prev, emptyDraftQuestion()]);
    setCurrentQ(questions.length);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    setCurrentQ((prev) => Math.min(prev, questions.length - 2));
  };

  const isValid = () => {
    if (!title.trim()) return false;
    return questions.every(
      (q) =>
        q.question.trim() &&
        q.options.every((o) => o.trim()) &&
        q.durationSeconds >= 5,
    );
  };

  const handleCreate = () => {
    if (!isValid()) {
      toast({ title: "Incomplete", description: "Fill in all question fields and keep duration at least 5s.", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      course,
      isAnonymous,
      questions: questions.map((q) => ({
        questionText: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        correctOptionIndex: q.correctIndex,
        difficulty: q.difficulty,
        durationSeconds: q.durationSeconds || 15,
      })),
    });
  };

  const q = questions[currentQ];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && createMutation.isPending) return;
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">Create a Quiz</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Quiz Title</label>
              <Input
                placeholder="e.g. OS Chapter 5 Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Course</label>
              <Select value={course} onValueChange={setCourse}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURSES.filter((c) => ["CS301", "CS302", "CS303", "CS304"].includes(c.code)).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {anonEnabled && (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Post As</label>
                <button
                  type="button"
                  onClick={() => setIsAnonymous((prev) => !prev)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 border transition-colors text-left",
                    isAnonymous ? "border-border bg-muted/50" : "border-primary/40 bg-primary/5"
                  )}
                >
                  {isAnonymous ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Eye className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold">{isAnonymous ? "Anonymous" : userName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {isAnonymous ? "Your name will be hidden" : "Your name will be visible"}
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Questions ({questions.length})
              </p>
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={addQuestion} disabled={questions.length >= 20} className="h-7 text-xs">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1">
              {questions.map((question, i) => {
                const filled = question.question.trim() && question.options.every((o) => o.trim());
                return (
                  <button
                    key={i}
                    onClick={() => setCurrentQ(i)}
                    className={cn(
                      "h-7 w-7 text-[10px] font-bold border transition-all",
                      i === currentQ
                        ? "bg-primary text-primary-foreground border-primary"
                        : filled
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {q && (
            <div className="space-y-3 border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">Question {currentQ + 1}</p>
                <div className="flex items-center gap-2">
                  <Select
                    value={q.difficulty}
                    onValueChange={(v) => updateQuestion(currentQ, { difficulty: v as "easy" | "medium" | "hard" })}
                  >
                    <SelectTrigger className="w-[100px] h-7 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={q.durationSeconds}
                    onChange={(e) =>
                      updateQuestion(currentQ, {
                        durationSeconds: Number(e.target.value) || 15,
                      })
                    }
                    className="w-[90px] h-7 text-[10px] px-2"
                  />
                  {questions.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeQuestion(currentQ)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Time per question (seconds)
              </p>

              <Textarea
                placeholder="Type your question..."
                value={q.question}
                onChange={(e) => updateQuestion(currentQ, { question: e.target.value })}
                className="min-h-[60px] text-sm resize-none"
                rows={2}
              />

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Options - click letter to set correct answer
                </p>
                {q.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => updateQuestion(currentQ, { correctIndex: i })}
                          className={cn(
                            "h-7 w-7 shrink-0 flex items-center justify-center border text-[10px] font-black transition-all",
                            q.correctIndex === i
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {String.fromCharCode(65 + i)}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left"><span>{q.correctIndex === i ? "Correct answer" : "Mark as correct"}</span></TooltipContent>
                    </Tooltip>
                    <Input
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      value={opt}
                      onChange={(e) => updateOption(currentQ, i, e.target.value)}
                      className="h-8 text-xs flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!isValid() || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Create Quiz
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomQuizzesList({
  onPlay,
}: {
  onPlay: (quiz: CustomQuiz) => void;
}) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [deletingQuiz, setDeletingQuiz] = useState<CustomQuiz | null>(null);
  const [reportQuiz, setReportQuiz] = useState<CustomQuiz | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const quizzesQuery = useInfiniteQuery({
    queryKey: ["arenaQuizzes"],
    queryFn: ({ pageParam = 1 }) =>
      fetchArenaQuizzes({
        page: pageParam,
        limit: 20,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.lastPage ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  const quizzes = quizzesQuery.data?.pages.flatMap((page) => page.data) || [];

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
      if (quizzesQuery.isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && quizzesQuery.hasNextPage) {
          quizzesQuery.fetchNextPage();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [quizzesQuery.isFetchingNextPage, quizzesQuery.hasNextPage, quizzesQuery.fetchNextPage],
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  if (!quizzesQuery.isLoading && quizzes.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Community Quizzes</h2>
        </div>

        {quizzesQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 border border-border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {quizzes.map((quiz, idx) => (
              <div
                key={quiz.id}
                ref={idx === quizzes.length - 1 ? lastQuizRef : undefined}
                className="border border-border p-3 flex items-center gap-3 hover:bg-accent/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{quiz.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{quiz.course}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{quiz.questionCount} Q</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {quiz.anonymous_id.startsWith("Anon#") ? (
                        <User className="h-2.5 w-2.5" />
                      ) : (
                        <UserCheck className="h-2.5 w-2.5 text-primary" />
                      )}
                      <span className={cn(!quiz.anonymous_id.startsWith("Anon#") && "text-foreground font-medium")}>
                        {quiz.anonymous_id}
                      </span>
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => playMutation.mutate(quiz.id)}
                  disabled={playMutation.isPending}
                >
                  {playMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Play
                </Button>
                {!quiz.createdByUser && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
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
                        className={cn("h-7 w-7 p-0", quiz.createdByUser ? "text-destructive hover:text-destructive" : "text-amber-500 hover:text-destructive")}
                        onClick={() => setDeletingQuiz(quiz)}
                      >
                        {quiz.createdByUser ? <Trash2 className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><span>{quiz.createdByUser ? "Delete quiz" : "Delete quiz (admin)"}</span></TooltipContent>
                  </Tooltip>
                )}
              </div>
            ))}
            {quizzesQuery.isFetchingNextPage && (
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
          onOpenChange={(o) => !o && setReportQuiz(null)}
          contentType="quiz"
          contentId={reportQuiz.id}
          contentPreview={reportQuiz.title + " (" + reportQuiz.questionCount + " questions)"}
          contentAuthor={reportQuiz.anonymous_id}
        />
      )}
    </>
  );
}
const Arena = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [playingCustomQuiz, setPlayingCustomQuiz] = useState<CustomQuiz | null>(null);
  const [leaderboardSearchInput, setLeaderboardSearchInput] = useState("");
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const leaderboardObserverRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLeaderboardSearch(leaderboardSearchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [leaderboardSearchInput]);

  const statsQuery = useQuery({
    queryKey: ["arenaStats"],
    queryFn: fetchArenaStats,
  });

  const leaderboardQuery = useInfiniteQuery({
    queryKey: ["leaderboard", leaderboardSearch],
    queryFn: ({ pageParam = 1 }) =>
      fetchLeaderboard({
        page: pageParam,
        limit: 20,
        search: leaderboardSearch || undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.lastPage ? lastPage.meta.page + 1 : undefined,
    initialPageParam: 1,
  });

  const leaderboard = useMemo(
    () => leaderboardQuery.data?.pages.flatMap((page) => page.data) || [],
    [leaderboardQuery.data],
  );

  const lastLeaderboardRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (leaderboardQuery.isFetchingNextPage) return;
      if (leaderboardObserverRef.current) leaderboardObserverRef.current.disconnect();
      leaderboardObserverRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && leaderboardQuery.hasNextPage) {
          leaderboardQuery.fetchNextPage();
        }
      });
      if (node) leaderboardObserverRef.current.observe(node);
    },
    [leaderboardQuery.isFetchingNextPage, leaderboardQuery.hasNextPage, leaderboardQuery.fetchNextPage],
  );

  useEffect(() => {
    return () => {
      if (leaderboardObserverRef.current) leaderboardObserverRef.current.disconnect();
    };
  }, []);

  const playerStats = statsQuery.data || DEFAULT_PLAYER_STATS;
  const title = playerStats.title || getTitle(playerStats.xp);
  const accuracy = playerStats.totalAnswers > 0
    ? Math.round((playerStats.correctAnswers / playerStats.totalAnswers) * 100)
    : 0;

  const handleUpdateStats = useCallback((stats: ArenaPlayerStats) => {
    queryClient.setQueryData(["arenaStats"], stats);
    setPlayingCustomQuiz(null);
  }, [queryClient]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Gamification</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">The Arena</h1>
        </div>
        <Button size="sm" className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3" />
          Create Quiz
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-widest text-primary">Title</p>
            <p className="text-lg font-black mt-1">{statsQuery.isLoading ? "..." : title}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">XP</p>
            </div>
            <p className="text-2xl font-black tabular-nums mt-1">{playerStats.xp.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-amber-500" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Wins</p>
            </div>
            <p className="text-2xl font-black tabular-nums mt-1">{playerStats.wins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <Flame className="h-3 w-3 text-amber-500" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Streak</p>
            </div>
            <p className="text-2xl font-black tabular-nums mt-1">{playerStats.streak}</p>
            {playerStats.bestStreak > 0 && (
              <p className="text-[9px] text-muted-foreground mt-0.5">Best: {playerStats.bestStreak}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-primary" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Accuracy</p>
            </div>
            <p className="text-2xl font-black tabular-nums mt-1">{accuracy}%</p>
          </CardContent>
        </Card>
      </div>

      <QuizBattle
        onUpdateStats={handleUpdateStats}
        customQuiz={playingCustomQuiz}
      />

      <CustomQuizzesList onPlay={(quiz) => setPlayingCustomQuiz(quiz)} />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Leaderboard</h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={leaderboardSearchInput}
            onChange={(e) => setLeaderboardSearchInput(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {leaderboardQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="h-5 w-5 bg-muted animate-pulse" />
                <div className="h-6 w-6 bg-muted animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 bg-muted animate-pulse" />
                  <div className="h-2.5 w-16 bg-muted animate-pulse" />
                </div>
                <div className="h-4 w-10 bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : leaderboardQuery.isError ? (
          <div className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Could not load leaderboard right now.
          </div>
        ) : (
          <>
            <Leaderboard data={leaderboard} lastItemRef={lastLeaderboardRef} />
            {leaderboardQuery.isFetchingNextPage && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>

      <div className="border border-border p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Title Progression</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries({ Rookie: 0, Scholar: 200, Strategist: 500, Champion: 1000, Legend: 2000 }).map(
            ([name, minXp]) => {
              const achieved = playerStats.xp >= minXp;
              return (
                <div
                  key={name}
                  className={cn(
                    "px-2.5 py-1.5 border text-[10px] font-bold uppercase tracking-wider",
                    achieved
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-border text-muted-foreground/40"
                  )}
                >
                  {name}
                  <span className="ml-1 font-normal">{minXp}+</span>
                </div>
              );
            }
          )}
        </div>
      </div>

      <CreateQuizDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["arenaQuizzes"] });
        }}
      />
    </div>
  );
};

export default Arena;
