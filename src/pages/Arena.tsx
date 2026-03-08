import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchLeaderboard,
  fetchQuizQuestions,
  loadCustomQuizzes,
  saveCustomQuiz,
  deleteCustomQuiz,
  type QuizQuestion,
  type CustomQuiz,
  type LeaderboardEntry,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IS_ADMIN, MOCK_USER_NAME } from "@/lib/user";
import { toast } from "@/hooks/use-toast";

// ─── Player stats (localStorage) ───
interface PlayerStats {
  xp: number;
  wins: number;
  totalPlayed: number;
  streak: number;
  bestStreak: number;
  correctAnswers: number;
  totalAnswers: number;
}

const STATS_KEY = "scola-arena-stats";

function loadStats(): PlayerStats {
  try {
    const s = localStorage.getItem(STATS_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return { xp: 0, wins: 0, totalPlayed: 0, streak: 0, bestStreak: 0, correctAnswers: 0, totalAnswers: 0 };
}

function saveStats(stats: PlayerStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function getTitle(xp: number): string {
  if (xp >= 2000) return "Legend";
  if (xp >= 1000) return "Champion";
  if (xp >= 500) return "Strategist";
  if (xp >= 200) return "Scholar";
  return "Rookie";
}

const difficultyXp = { easy: 10, medium: 20, hard: 30 };
const QUIZ_TIME = 15;

// ─── Rank badge colors ───
function rankStyle(rank: number) {
  if (rank === 1) return "bg-amber-400/15 text-amber-500 border-amber-400/40";
  if (rank === 2) return "bg-slate-300/15 text-slate-400 border-slate-300/40";
  if (rank === 3) return "bg-amber-600/15 text-amber-700 border-amber-600/40";
  return "bg-muted text-muted-foreground border-border";
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
  return <span className="text-xs font-black tabular-nums text-muted-foreground">#{rank}</span>;
}

// ─── Leaderboard Table ───
function Leaderboard({ data, search }: { data: LeaderboardEntry[]; search: string }) {
  const filtered = data.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.anonymous_id.toLowerCase().includes(q) || e.title.toLowerCase().includes(q);
  });

  return (
    <div className="border border-border overflow-hidden">
      <div className="grid grid-cols-[40px_1fr_60px_50px_50px_60px] sm:grid-cols-[48px_1fr_80px_64px_64px_80px] gap-1 px-3 py-2 bg-muted/50 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">XP</span>
        <span className="text-right">Wins</span>
        <span className="text-right hidden sm:block">Acc%</span>
        <span className="text-right">Streak</span>
      </div>
      {filtered.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No players match your search</div>
      ) : (
        filtered.map((entry) => (
          <div
            key={entry.rank}
            className={cn(
              "grid grid-cols-[40px_1fr_60px_50px_50px_60px] sm:grid-cols-[48px_1fr_80px_64px_64px_80px] gap-1 px-3 py-2.5 border-b border-border last:border-b-0 items-center",
              entry.rank <= 3 && "bg-accent/30"
            )}
          >
            <div className="flex items-center justify-center">
              <RankIcon rank={entry.rank} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{entry.anonymous_id}</p>
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
        ))
      )}
    </div>
  );
}

// ─── Quiz Battle Component ───
type QuizState = "idle" | "playing" | "result";

function QuizBattle({
  playerStats,
  onUpdateStats,
  customQuizQuestions,
}: {
  playerStats: PlayerStats;
  onUpdateStats: (stats: PlayerStats) => void;
  customQuizQuestions?: QuizQuestion[] | null;
}) {
  const [course, setCourse] = useState("CS301");
  const [state, setState] = useState<QuizState>(customQuizQuestions ? "playing" : "idle");
  const [questions, setQuestions] = useState<QuizQuestion[]>(customQuizQuestions || []);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME);
  const [xpEarned, setXpEarned] = useState(0);

  // Initialize with custom quiz questions if provided
  useEffect(() => {
    if (customQuizQuestions && customQuizQuestions.length > 0) {
      setQuestions(customQuizQuestions);
      setCurrentIdx(0);
      setSelected(null);
      setAnswered(false);
      setScore(0);
      setCorrectCount(0);
      setTimeLeft(QUIZ_TIME);
      setXpEarned(0);
      setState("playing");
    }
  }, [customQuizQuestions]);

  const startQuiz = useCallback(async () => {
    const qs = await fetchQuizQuestions(course);
    setQuestions(qs);
    setCurrentIdx(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setCorrectCount(0);
    setTimeLeft(QUIZ_TIME);
    setXpEarned(0);
    setState("playing");
  }, [course]);

  useEffect(() => {
    if (state !== "playing" || answered) return;
    if (timeLeft <= 0) {
      setAnswered(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [state, timeLeft, answered]);

  const handleAnswer = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    const q = questions[currentIdx];
    if (idx === q.correctIndex) {
      const pts = difficultyXp[q.difficulty];
      setScore((p) => p + pts);
      setCorrectCount((p) => p + 1);
      setXpEarned((p) => p + pts);
    }
  };

  const nextQuestion = () => {
    if (currentIdx + 1 >= questions.length) {
      const won = correctCount >= Math.ceil(questions.length / 2);
      const newStats: PlayerStats = {
        ...playerStats,
        xp: playerStats.xp + xpEarned,
        wins: playerStats.wins + (won ? 1 : 0),
        totalPlayed: playerStats.totalPlayed + 1,
        streak: won ? playerStats.streak + 1 : 0,
        bestStreak: won ? Math.max(playerStats.bestStreak, playerStats.streak + 1) : playerStats.bestStreak,
        correctAnswers: playerStats.correctAnswers + correctCount,
        totalAnswers: playerStats.totalAnswers + questions.length,
      };
      onUpdateStats(newStats);
      setState("result");
      return;
    }
    setCurrentIdx((p) => p + 1);
    setSelected(null);
    setAnswered(false);
    setTimeLeft(QUIZ_TIME);
  };

  const currentQ = questions[currentIdx];
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
            5 questions · {QUIZ_TIME}s per question · Earn XP based on difficulty
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
                      {c.code} — {c.name}
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

  if (state === "result") {
    const won = correctCount >= Math.ceil(questions.length / 2);
    const accuracy = Math.round((correctCount / questions.length) * 100);
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

          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => setState("idle")}>
              <RotateCcw className="h-3 w-3" />
              New Battle
            </Button>
            <Button onClick={startQuiz}>
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
  const timerPct = (timeLeft / QUIZ_TIME) * 100;

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

// ─── Create Quiz Dialog ───
interface DraftQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  difficulty: "easy" | "medium" | "hard";
}

const emptyDraftQuestion = (): DraftQuestion => ({
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  difficulty: "medium",
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
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("CS301");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyDraftQuestion()]);
  const [currentQ, setCurrentQ] = useState(0);

  const resetForm = () => {
    setTitle("");
    setCourse("CS301");
    setIsAnonymous(true);
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
      (q) => q.question.trim() && q.options.every((o) => o.trim())
    );
  };

  const handleCreate = () => {
    if (!isValid()) {
      toast({ title: "Incomplete", description: "Fill in all question and option fields.", variant: "destructive" });
      return;
    }

    const quiz: CustomQuiz = {
      id: `cq-${Date.now()}`,
      title: title.trim(),
      course,
      questions: questions.map((q, i) => ({
        id: `cq-${Date.now()}-q${i}`,
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        correctIndex: q.correctIndex,
        course,
        difficulty: q.difficulty,
      })),
      createdAt: new Date().toISOString(),
      anonymous_id: isAnonymous ? `Anon#${Math.floor(1000 + Math.random() * 9000)}` : MOCK_USER_NAME,
      createdByUser: true,
    };

    saveCustomQuiz(quiz);
    toast({ title: "Quiz Created!", description: `"${quiz.title}" with ${quiz.questions.length} questions.` });
    resetForm();
    onOpenChange(false);
    onCreated();
  };

  const q = questions[currentQ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider text-sm">Create a Quiz</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title & Course */}
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
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Anonymous toggle */}
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
                  <p className="text-xs font-bold">{isAnonymous ? "Anonymous" : MOCK_USER_NAME}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {isAnonymous ? "Your name will be hidden" : "Your name will be visible"}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Question tabs */}
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

            {/* Question selector pills */}
            <div className="flex flex-wrap gap-1">
              {questions.map((q, i) => {
                const filled = q.question.trim() && q.options.every((o) => o.trim());
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

          {/* Current question editor */}
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

              <Textarea
                placeholder="Type your question..."
                value={q.question}
                onChange={(e) => updateQuestion(currentQ, { question: e.target.value })}
                className="min-h-[60px] text-sm resize-none"
                rows={2}
              />

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Options — click letter to set correct answer
                </p>
                {q.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuestion(currentQ, { correctIndex: i })}
                      className={cn(
                        "h-7 w-7 shrink-0 flex items-center justify-center border text-[10px] font-black transition-all",
                        q.correctIndex === i
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                      title={q.correctIndex === i ? "Correct answer" : "Mark as correct"}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!isValid()}>
              <Plus className="h-3 w-3" />
              Create Quiz
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Custom Quizzes List ───
function CustomQuizzesList({
  onPlay,
  refreshKey,
}: {
  onPlay: (quiz: CustomQuiz) => void;
  refreshKey: number;
}) {
  const [quizzes, setQuizzes] = useState<CustomQuiz[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setQuizzes(loadCustomQuizzes());
  }, [refreshKey]);

  const handleDelete = () => {
    if (!deletingId) return;
    deleteCustomQuiz(deletingId);
    setQuizzes(loadCustomQuizzes());
    setDeletingId(null);
    toast({ title: "Deleted", description: "Quiz has been removed." });
  };

  if (quizzes.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Community Quizzes</h2>
        </div>

        <div className="space-y-2">
          {quizzes.map((quiz) => {
            const courseLabel = COURSES.find((c) => c.code === quiz.course)?.name || quiz.course;
            return (
              <div key={quiz.id} className="border border-border p-3 flex items-center gap-3 hover:bg-accent/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{quiz.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{quiz.course}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{quiz.questions.length} Q</span>
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
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onPlay(quiz)}>
                  <Play className="h-3 w-3" /> Play
                </Button>
                {(quiz.createdByUser || IS_ADMIN) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn("h-7 w-7 p-0", quiz.createdByUser ? "text-destructive hover:text-destructive" : "text-amber-500 hover:text-destructive")}
                    onClick={() => setDeletingId(quiz.id)}
                    title={quiz.createdByUser ? "Delete quiz" : "Delete quiz (admin)"}
                  >
                    {quiz.createdByUser ? <Trash2 className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quiz</AlertDialogTitle>
            <AlertDialogDescription>This quiz will be permanently removed. Continue?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Main Page ───
const Arena = () => {
  const [playerStats, setPlayerStats] = useState<PlayerStats>(loadStats);
  const [createOpen, setCreateOpen] = useState(false);
  const [customQuizRefresh, setCustomQuizRefresh] = useState(0);
  const [playingCustomQuiz, setPlayingCustomQuiz] = useState<CustomQuiz | null>(null);

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
  });

  const [leaderboardSearch, setLeaderboardSearch] = useState("");

  const handleUpdateStats = useCallback((stats: PlayerStats) => {
    setPlayerStats(stats);
    saveStats(stats);
    setPlayingCustomQuiz(null);
  }, []);

  const accuracy = playerStats.totalAnswers > 0
    ? Math.round((playerStats.correctAnswers / playerStats.totalAnswers) * 100)
    : 0;
  const title = getTitle(playerStats.xp);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="border-b border-border pb-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Gamification</p>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">The Arena</h1>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3" />
          Create Quiz
        </Button>
      </div>

      {/* Player stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-widest text-primary">Title</p>
            <p className="text-lg font-black mt-1">{title}</p>
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

      {/* Quiz Battle */}
      <QuizBattle
        playerStats={playerStats}
        onUpdateStats={handleUpdateStats}
        customQuizQuestions={playingCustomQuiz?.questions}
      />

      {/* Custom Quizzes */}
      <CustomQuizzesList
        refreshKey={customQuizRefresh}
        onPlay={(quiz) => setPlayingCustomQuiz(quiz)}
      />

      {/* Leaderboard */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Leaderboard</h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={leaderboardSearch}
            onChange={(e) => setLeaderboardSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse" />
            ))}
          </div>
        ) : leaderboard ? (
          <Leaderboard data={leaderboard} search={leaderboardSearch} />
        ) : null}
      </div>

      {/* XP Title progression */}
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

      {/* Create Quiz Dialog */}
      <CreateQuizDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => setCustomQuizRefresh((p) => p + 1)}
      />
    </div>
  );
};

export default Arena;
