import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Swords,
  Timer,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  fetchRandomQuizByCourse,
  submitArenaAttempt,
  type ArenaPlayerStats,
  type CustomQuiz,
  type QuizQuestion,
} from "@/services/arena";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CourseSelectDropdown } from "@/components/CourseSelectDropdown";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { DIFFICULTY_XP } from "../constants";
import { getArenaCourseLabel, getErrorMessage, toArenaCourseCode } from "../utils";

type QuizState = "idle" | "playing" | "submitting" | "result";

interface QuizBattleProps {
  onUpdateStats: (stats: ArenaPlayerStats) => void;
  customQuiz?: CustomQuiz | null;
}

export function QuizBattle({ onUpdateStats, customQuiz }: QuizBattleProps) {
  const [course, setCourse] = useState("");
  const [courseName, setCourseName] = useState("");
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
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  const currentQ = questions[currentIdx];
  const currentDuration = currentQ?.durationSeconds || 15;

  useEffect(() => {
    if (!customQuiz?.questions?.length) return;
    if (!customQuiz.canAttempt) {
      toast({
        title: "Attempt Limit Reached",
        description: `You have used all ${customQuiz.maxAttempts} attempts for this quiz.`,
        variant: "destructive",
      });
      return;
    }
    setQuestions(customQuiz.questions);
    setActiveQuizId(customQuiz.id);
    setCourse(customQuiz.course);
    setCourseName("");
    setMaxAttempts(customQuiz.maxAttempts);
    setAttemptsRemaining(customQuiz.attemptsRemaining);
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
    if (!course) {
      toast({ title: "Course Required", description: "Choose a course before starting.", variant: "destructive" });
      return;
    }
    try {
      const quiz = await fetchRandomQuizByCourse(course);
      if (!quiz.questions?.length) {
        toast({ title: "No Quiz Found", description: "No questions available for this course.", variant: "destructive" });
        return;
      }
      setQuestions(quiz.questions);
      setActiveQuizId(quiz.id);
      setMaxAttempts(quiz.maxAttempts);
      setAttemptsRemaining(quiz.attemptsRemaining);
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
    const timeout = setTimeout(() => setTimeLeft((previous) => previous - 1), 1000);
    return () => clearTimeout(timeout);
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
      const points = DIFFICULTY_XP[currentQ.difficulty];
      setScore((prev) => prev + points);
      setCorrectCount((prev) => prev + 1);
      setXpEarned((prev) => prev + points);
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
      setMaxAttempts(result.maxAttempts);
      setAttemptsRemaining(result.attemptsRemaining);
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
    setCurrentIdx((previous) => previous + 1);
    setSelected(null);
    setAnswered(false);
  };

  const selectedCourseLabel = getArenaCourseLabel(course, courseName);
  const resultCourseName = courseName || course;

  if (state === "idle") {
    return (
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <h3 className="font-bold uppercase tracking-wider text-sm">Start a Quiz Battle</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Picks a random quiz from the selected course - timed per question - Earn XP based on difficulty
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Subject</p>
              <CourseSelectDropdown
                value={course || undefined}
                onChange={(value, selectedCourse) => {
                  const nextCourse = toArenaCourseCode(value, selectedCourse);
                  if (nextCourse === null) {
                    toast({
                      title: "Course Code Required",
                      description: "Arena quizzes need a coded course.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setCourse(nextCourse);
                  setCourseName(selectedCourse?.name?.trim() || "");
                }}
                placeholder="Select course"
                className="w-[220px] h-9 text-xs"
                selectedLabel={selectedCourseLabel}
              />
            </div>
            <Button onClick={startQuiz} disabled={!course}>
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
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{resultCourseName}</p>
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
            <Button className="w-full sm:w-auto" onClick={startQuiz} disabled={attemptsRemaining !== null && attemptsRemaining <= 0}>
              <Swords className="h-3 w-3" />
              Rematch
            </Button>
          </div>
          {attemptsRemaining !== null && (
            <p className={cn(
              "text-[10px] uppercase tracking-wider",
              attemptsRemaining > 0 ? "text-muted-foreground" : "text-destructive"
            )}>
              Attempts remaining: {attemptsRemaining}/{maxAttempts}
            </p>
          )}
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
          {currentQ.options.map((option, idx) => {
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
                <span className="text-sm flex-1">{option}</span>
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
                <span className="text-emerald-600">+{DIFFICULTY_XP[currentQ.difficulty]} XP</span>
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
