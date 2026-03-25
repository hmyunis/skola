import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, Info, Loader2, Plus, Trash2 } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { parseQuizUpload, QUIZ_IMPORT_PROMPT_TEMPLATE } from "../quizImport";
import { getArenaCourseLabel, getErrorMessage, toArenaCourseCode } from "../utils";

interface DraftQuestion {
  question: string;
  options: string[];
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
  const [maxAttempts, setMaxAttempts] = useState(2);
  const anonEnabled = useFeatureEnabled("ft-anon-posting");
  const [isAnonymous, setIsAnonymous] = useState(anonEnabled);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyDraftQuestion()]);
  const [currentQ, setCurrentQ] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportExpanded, setIsImportExpanded] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [isPromptCopied, setIsPromptCopied] = useState(false);

  useEffect(() => {
    if (!anonEnabled) setIsAnonymous(false);
  }, [anonEnabled]);

  useEffect(() => {
    if (!isPromptCopied) return;
    const timeout = setTimeout(() => setIsPromptCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [isPromptCopied]);

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
    setMaxAttempts(2);
    setIsAnonymous(anonEnabled);
    setQuestions([emptyDraftQuestion()]);
    setCurrentQ(0);
    setIsImporting(false);
    setIsImportExpanded(false);
    setImportJsonText("");
    setIsPromptCopied(false);
  };

  const updateQuestion = (idx: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) => prev.map((question, i) => (i === idx ? { ...question, ...patch } : question)));
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== qIdx) return question;
        const nextOptions = [...question.options];
        nextOptions[optIdx] = value;
        return { ...question, options: nextOptions };
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
    setCurrentQ((prev) => {
      if (prev > idx) return prev - 1;
      return Math.min(prev, questions.length - 2);
    });
  };

  const addOption = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== qIdx || question.options.length >= 6) return question;
        return { ...question, options: [...question.options, ""] };
      })
    );
  };

  const removeOption = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== qIdx || question.options.length <= 2) return question;
        const nextOptions = question.options.slice(0, -1);
        const nextCorrect = Math.min(question.correctIndex, nextOptions.length - 1);
        return { ...question, options: nextOptions, correctIndex: nextCorrect };
      })
    );
  };

  const isValid = () => {
    if (!title.trim()) return false;
    if (!course.trim()) return false;
    if (!Number.isFinite(maxAttempts) || maxAttempts < 1) return false;
    if (questions.length < 1 || questions.length > 20) return false;

    return questions.every((question) => {
      if (!question.question.trim()) return false;
      if (question.options.length < 2 || question.options.length > 6) return false;
      if (question.options.some((option) => !option.trim())) return false;
      if (question.correctIndex < 0 || question.correctIndex >= question.options.length) return false;
      if (!Number.isFinite(question.durationSeconds) || question.durationSeconds < 5) return false;
      return true;
    });
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(QUIZ_IMPORT_PROMPT_TEMPLATE);
      setIsPromptCopied(true);
      toast({ title: "Prompt Copied", description: "Paste it into your AI tool to format quiz JSON." });
    } catch {
      toast({
        title: "Copy Failed",
        description: "Clipboard access was blocked by the browser.",
        variant: "destructive",
      });
    }
  };

  const handleImportJson = () => {
    if (!importJsonText.trim()) {
      toast({
        title: "No JSON Provided",
        description: "Paste quiz JSON before parsing.",
        variant: "destructive",
      });
      return;
    }
    setIsImporting(true);
    try {
      const imported = parseQuizUpload(importJsonText, "Pasted Quiz");
      setQuestions(imported.questions.map((question) => ({ ...question, options: [...question.options] })));
      setCurrentQ(0);
      toast({
        title: "JSON Parsed",
        description: `${imported.questions.length} questions loaded.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Parse Failed",
        description: getErrorMessage(error, "Could not parse the pasted JSON."),
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreate = () => {
    if (!isValid()) {
      toast({
        title: "Incomplete Quiz",
        description: "Fill all fields, keep 2-6 options, and duration at least 5 seconds.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      course,
      isAnonymous,
      maxAttempts: Math.floor(maxAttempts),
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
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Max Attempts Per User</label>
              <Input
                type="number"
                min={1}
                value={maxAttempts}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (!Number.isFinite(parsed) || parsed < 1) {
                    setMaxAttempts(1);
                    return;
                  }
                  setMaxAttempts(Math.floor(parsed));
                }}
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Default is 2 (first attempt + one retry).
              </p>
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

            <div className="space-y-2 border border-dashed border-border p-3 bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Import Questions (JSON)</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="h-5 w-5 inline-flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-background"
                        aria-label="Show JSON prompt format"
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(92vw,28rem)] p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Prompt Template</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          onClick={handleCopyPrompt}
                        >
                          {isPromptCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {isPromptCopied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Paste this prompt into an AI tool to convert your quiz into the required JSON format.
                      </p>
                      <pre className="max-h-56 overflow-auto rounded border border-border bg-background p-2 text-[10px] leading-relaxed whitespace-pre-wrap">
                        {QUIZ_IMPORT_PROMPT_TEMPLATE}
                      </pre>
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px]"
                  onClick={() => setIsImportExpanded((prev) => !prev)}
                  disabled={createMutation.isPending}
                >
                  {isImportExpanded ? "Hide JSON Box" : "Show JSON Box"}
                </Button>
              </div>

              {isImportExpanded && (
                <div className="space-y-2">
                  <Textarea
                    value={importJsonText}
                    onChange={(event) => setImportJsonText(event.target.value)}
                    placeholder='Paste JSON here. Example: {"questions":[{"questionText":"...","options":["A","B"],"correctOptionIndex":0,"difficulty":"medium","durationSeconds":15}]}'
                    className="min-h-[140px] text-xs font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-xs w-full sm:w-auto"
                    onClick={handleImportJson}
                    disabled={isImporting || createMutation.isPending}
                  >
                    {isImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {isImporting ? "Parsing..." : "Parse JSON"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground break-words">
                    Parsed JSON fills only the manual question fields below.
                  </p>
                </div>
              )}
            </div>
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

            <div className="flex gap-1 overflow-x-auto pb-1">
              {questions.map((draftQuestion, i) => {
                const filled =
                  draftQuestion.question.trim() &&
                  draftQuestion.options.length >= 2 &&
                  draftQuestion.options.every((option) => option.trim()) &&
                  draftQuestion.correctIndex >= 0 &&
                  draftQuestion.correctIndex < draftQuestion.options.length;

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentQ(i)}
                    className={cn(
                      "h-7 min-w-7 px-1 text-[10px] font-bold border transition-all shrink-0",
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
                      <SelectTrigger className="w-full sm:w-[110px] h-7 text-[10px]">
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
                      max={300}
                      value={question.durationSeconds}
                      onChange={(event) => {
                        const parsed = Number(event.target.value);
                        updateQuestion(currentQ, {
                          durationSeconds: Number.isFinite(parsed) && parsed >= 5 ? Math.floor(parsed) : 5,
                        });
                      }}
                      className="w-full sm:w-[100px] h-7 text-[10px] px-2"
                    />
                  </div>
                  {questions.length > 1 && (
                    <Button
                      type="button"
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
                className="min-h-[70px] text-sm resize-none"
                rows={3}
              />

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    Options ({question.options.length}) - click letter to set correct answer
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => removeOption(currentQ)}
                      disabled={question.options.length <= 2}
                    >
                      - Option
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => addOption(currentQ)}
                      disabled={question.options.length >= 6}
                    >
                      + Option
                    </Button>
                  </div>
                </div>
                {question.options.map((option, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
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

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              className="w-full sm:w-auto"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={handleCreate} disabled={!isValid() || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Create Quiz
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
