import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { createArenaQuiz } from "@/services/arena";
import { CourseSelectDropdown } from "@/components/CourseSelectDropdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useFeatureEnabled } from "@/services/features";
import { useAuth } from "@/stores/authStore";
import { getArenaCourseLabel, getErrorMessage, toArenaCourseCode } from "../utils";

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

interface CreateQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateQuizDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateQuizDialogProps) {
  const { userName } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [courseName, setCourseName] = useState("");
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
    setCourse("");
    setCourseName("");
    setIsAnonymous(anonEnabled);
    setQuestions([emptyDraftQuestion()]);
    setCurrentQ(0);
  };

  const updateQuestion = (idx: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) => prev.map((question, i) => (i === idx ? { ...question, ...patch } : question)));
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== qIdx) return question;
        const newOptions = [...question.options] as [string, string, string, string];
        newOptions[optIdx] = value;
        return { ...question, options: newOptions };
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
    if (!course.trim()) return false;
    return questions.every(
      (question) =>
        question.question.trim() &&
        question.options.every((option) => option.trim()) &&
        question.durationSeconds >= 5,
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
      questions: questions.map((question) => ({
        questionText: question.question.trim(),
        options: question.options.map((option) => option.trim()),
        correctOptionIndex: question.correctIndex,
        difficulty: question.difficulty,
        durationSeconds: question.durationSeconds || 15,
      })),
    });
  };

  const question = questions[currentQ];

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
          <DialogDescription className="sr-only">
            Create a custom quiz by setting title, course, and questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Quiz Title</label>
              <Input
                placeholder="e.g. OS Chapter 5 Review"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Course</label>
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
                className="w-full h-9 text-xs"
                selectedLabel={getArenaCourseLabel(course, courseName)}
              />
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
              {questions.map((draftQuestion, i) => {
                const filled = draftQuestion.question.trim() && draftQuestion.options.every((option) => option.trim());
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

          {question && (
            <div className="space-y-3 border border-border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-bold">Question {currentQ + 1}</p>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <Select
                      value={question.difficulty}
                      onValueChange={(value) => updateQuestion(currentQ, { difficulty: value as "easy" | "medium" | "hard" })}
                    >
                      <SelectTrigger className="w-full sm:w-[100px] h-7 text-[10px]">
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
                      value={question.durationSeconds}
                      onChange={(event) =>
                        updateQuestion(currentQ, {
                          durationSeconds: Number(event.target.value) || 15,
                        })
                      }
                      className="w-full sm:w-[90px] h-7 text-[10px] px-2"
                    />
                  </div>
                  {questions.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
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
                value={question.question}
                onChange={(event) => updateQuestion(currentQ, { question: event.target.value })}
                className="min-h-[60px] text-sm resize-none"
                rows={2}
              />

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Options - click letter to set correct answer
                </p>
                {question.options.map((option, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => updateQuestion(currentQ, { correctIndex: i })}
                          className={cn(
                            "h-7 w-7 shrink-0 flex items-center justify-center border text-[10px] font-black transition-all",
                            question.correctIndex === i
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          {String.fromCharCode(65 + i)}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left"><span>{question.correctIndex === i ? "Correct answer" : "Mark as correct"}</span></TooltipContent>
                    </Tooltip>
                    <Input
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      value={option}
                      onChange={(event) => updateOption(currentQ, i, event.target.value)}
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
