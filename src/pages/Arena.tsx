import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard, fetchQuizQuestions, type QuizQuestion, type LeaderboardEntry } from "@/services/arena";
import { COURSES } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
const QUIZ_TIME = 15; // seconds per question

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
function Leaderboard({ data }: { data: LeaderboardEntry[] }) {
  return (
    <div className="border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_60px_50px_50px_60px] sm:grid-cols-[48px_1fr_80px_64px_64px_80px] gap-1 px-3 py-2 bg-muted/50 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">XP</span>
        <span className="text-right">Wins</span>
        <span className="text-right hidden sm:block">Acc%</span>
        <span className="text-right">Streak</span>
      </div>
      {data.map((entry) => (
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
      ))}
    </div>
  );
}

// ─── Quiz Battle Component ───
type QuizState = "idle" | "playing" | "result";

function QuizBattle({
  playerStats,
  onUpdateStats,
}: {
  playerStats: PlayerStats;
  onUpdateStats: (stats: PlayerStats) => void;
}) {
  const [course, setCourse] = useState("CS301");
  const [state, setState] = useState<QuizState>("idle");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME);
  const [xpEarned, setXpEarned] = useState(0);

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

  // Timer
  useEffect(() => {
    if (state !== "playing" || answered) return;
    if (timeLeft <= 0) {
      // Time's up — treat as wrong
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
      // Quiz complete
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

  // Playing state
  const progress = ((currentIdx + (answered ? 1 : 0)) / questions.length) * 100;
  const timerPct = (timeLeft / QUIZ_TIME) * 100;

  return (
    <Card className="border-2 border-primary/30">
      <CardContent className="p-5 space-y-4">
        {/* Progress + Timer header */}
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

        {/* Timer bar */}
        <div className="h-1 bg-muted overflow-hidden">
          <div
            className={cn("h-full transition-all duration-1000 linear", timeLeft <= 5 ? "bg-destructive" : "bg-primary")}
            style={{ width: `${timerPct}%` }}
          />
        </div>

        {/* Question */}
        <p className="text-sm font-bold leading-relaxed py-2">{currentQ.question}</p>

        {/* Options */}
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
                className={cn(
                  "w-full text-left p-3 flex items-center gap-3 transition-all",
                  optionClass
                )}
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

        {/* Next button */}
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

// ─── Main Page ───
const Arena = () => {
  const [playerStats, setPlayerStats] = useState<PlayerStats>(loadStats);

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
  });

  const handleUpdateStats = useCallback((stats: PlayerStats) => {
    setPlayerStats(stats);
    saveStats(stats);
  }, []);

  const accuracy = playerStats.totalAnswers > 0
    ? Math.round((playerStats.correctAnswers / playerStats.totalAnswers) * 100)
    : 0;
  const title = getTitle(playerStats.xp);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Gamification</p>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider">The Arena</h1>
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
      <QuizBattle playerStats={playerStats} onUpdateStats={handleUpdateStats} />

      {/* Leaderboard */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Leaderboard</h2>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse" />
            ))}
          </div>
        ) : leaderboard ? (
          <Leaderboard data={leaderboard} />
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
    </div>
  );
};

export default Arena;
