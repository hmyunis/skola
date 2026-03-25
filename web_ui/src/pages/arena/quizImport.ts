export type QuizImportDifficulty = "easy" | "medium" | "hard";

export interface ImportedQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: QuizImportDifficulty;
  durationSeconds: number;
}

export interface ImportedQuizPayload {
  title: string;
  course: string;
  maxAttempts: number;
  questions: ImportedQuizQuestion[];
}

const MAX_QUESTIONS = 20;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

export const QUIZ_IMPORT_PROMPT_TEMPLATE = [
  "Convert my quiz into strict JSON for app paste-import.",
  "Return ONLY valid JSON (no markdown, no comments).",
  "Required shape:",
  "{",
  '  "questions": [',
  "    {",
  '      "questionText": "question text",',
  '      "options": ["option A", "option B", "option C", "option D"],',
  '      "correctOptionIndex": 0,',
  '      "difficulty": "easy | medium | hard",',
  '      "durationSeconds": 15',
  "    }",
  "  ]",
  "}",
  "Rules:",
  "- 1 to 20 questions",
  "- 2 to 6 options per question",
  "- correctOptionIndex must be 0-based",
  "- durationSeconds must be >= 5",
].join("\n");

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecordValue(record: JsonRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function normalizeTitle(input: unknown, fallbackTitle: string) {
  if (typeof input === "string" && input.trim()) return input.trim();
  return fallbackTitle || "Imported Quiz";
}

function normalizeCourse(input: unknown) {
  if (typeof input !== "string") return "";
  return input.trim().toUpperCase();
}

function normalizeMaxAttempts(input: unknown) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return 2;
  const normalized = Math.floor(parsed);
  return normalized >= 1 ? normalized : 2;
}

function normalizeDifficulty(input: unknown): QuizImportDifficulty {
  const value = String(input || "").trim().toLowerCase();
  if (value === "easy" || value === "medium" || value === "hard") return value;
  if (value.includes("easy")) return "easy";
  if (value.includes("hard")) return "hard";
  return "medium";
}

function normalizeDurationSeconds(input: unknown): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return 15;
  const normalized = Math.floor(parsed);
  if (normalized < 5) return 15;
  return Math.min(normalized, 300);
}

function pickFirstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined);
}

function pickTextFromRecord(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = getRecordValue(record, key);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function parseOptionValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (isRecord(value)) {
    const nested = pickFirstDefined(
      getRecordValue(value, "text"),
      getRecordValue(value, "label"),
      getRecordValue(value, "value"),
      getRecordValue(value, "option"),
    );
    if (typeof nested === "string") return nested.trim();
    if (typeof nested === "number" || typeof nested === "boolean") return String(nested).trim();
  }
  return "";
}

function parseOptions(record: JsonRecord): string[] {
  const listCandidate = pickFirstDefined(
    getRecordValue(record, "options"),
    getRecordValue(record, "choices"),
    getRecordValue(record, "answers"),
    getRecordValue(record, "answerOptions"),
  );
  if (Array.isArray(listCandidate)) return listCandidate.map(parseOptionValue);

  if (isRecord(listCandidate)) {
    const preferred = ["A", "B", "C", "D", "E", "F"].filter((key) =>
      getRecordValue(listCandidate, key) !== undefined,
    );
    const keys = preferred.length ? preferred : Object.keys(listCandidate);
    return keys.map((key) => parseOptionValue(getRecordValue(listCandidate, key)));
  }

  const inferredKeys = [
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "optionE",
    "optionF",
    "choiceA",
    "choiceB",
    "choiceC",
    "choiceD",
    "choiceE",
    "choiceF",
  ];
  const inferred = inferredKeys
    .map((key) => parseOptionValue(getRecordValue(record, key)))
    .filter((option) => option.length > 0);
  if (inferred.length > 0) return inferred;

  return [];
}

function parseIndexFromIndexField(raw: number, optionsLength: number): number | null {
  if (!Number.isInteger(raw)) return null;
  if (raw >= 0 && raw < optionsLength) return raw;
  if (raw >= 1 && raw <= optionsLength) return raw - 1;
  return null;
}

function parseIndexFromAnswerValue(raw: unknown, options: string[]): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    if (raw >= 1 && raw <= options.length) return raw - 1;
    if (raw >= 0 && raw < options.length) return raw;
    return null;
  }
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    const numericValue = Number(value);
    if (numericValue >= 1 && numericValue <= options.length) return numericValue - 1;
    if (numericValue >= 0 && numericValue < options.length) return numericValue;
  }

  const letterCode = value.toUpperCase().charCodeAt(0);
  if (value.length === 1 && letterCode >= 65 && letterCode <= 90) {
    const letterIndex = letterCode - 65;
    if (letterIndex < options.length) return letterIndex;
  }

  const optionIndex = options.findIndex((option) => option.toLowerCase() === value.toLowerCase());
  return optionIndex >= 0 ? optionIndex : null;
}

function parseCorrectIndex(record: JsonRecord, options: string[]) {
  const explicitIndex = pickFirstDefined(
    getRecordValue(record, "correctOptionIndex"),
    getRecordValue(record, "correctIndex"),
    getRecordValue(record, "answerIndex"),
    getRecordValue(record, "correct_answer_index"),
    getRecordValue(record, "answer_index"),
  );
  if (typeof explicitIndex === "number" || (typeof explicitIndex === "string" && /^\d+$/.test(explicitIndex.trim()))) {
    const parsed = parseIndexFromIndexField(Number(explicitIndex), options.length);
    if (parsed !== null) return parsed;
  }

  const optionList = pickFirstDefined(
    getRecordValue(record, "options"),
    getRecordValue(record, "choices"),
    getRecordValue(record, "answers"),
    getRecordValue(record, "answerOptions"),
  );
  if (Array.isArray(optionList)) {
    const flaggedIndex = optionList.findIndex((option) => {
      if (!isRecord(option)) return false;
      const flagValue = pickFirstDefined(
        getRecordValue(option, "isCorrect"),
        getRecordValue(option, "correct"),
        getRecordValue(option, "is_answer"),
      );
      return flagValue === true || String(flagValue).toLowerCase() === "true";
    });
    if (flaggedIndex >= 0 && flaggedIndex < options.length) return flaggedIndex;
  }

  const answerValue = pickFirstDefined(
    getRecordValue(record, "correctAnswer"),
    getRecordValue(record, "correct_answer"),
    getRecordValue(record, "correct"),
    getRecordValue(record, "answer"),
    getRecordValue(record, "solution"),
  );
  const parsedAnswer = parseIndexFromAnswerValue(answerValue, options);
  if (parsedAnswer !== null) return parsedAnswer;

  throw new Error("Missing or invalid correct answer");
}

function extractQuestionsContainer(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!isRecord(parsed)) return null;

  const candidates: unknown[] = [
    getRecordValue(parsed, "questions"),
    getRecordValue(parsed, "items"),
    getRecordValue(parsed, "quizQuestions"),
    getRecordValue(parsed, "questionBank"),
  ];

  const nestedContainers = [
    getRecordValue(parsed, "quiz"),
    getRecordValue(parsed, "data"),
    getRecordValue(parsed, "payload"),
  ];
  for (const nested of nestedContainers) {
    if (!isRecord(nested)) continue;
    candidates.push(
      getRecordValue(nested, "questions"),
      getRecordValue(nested, "items"),
      getRecordValue(nested, "quizQuestions"),
    );
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return null;
}

function extractMeta(parsed: unknown) {
  if (!isRecord(parsed)) return { title: undefined, course: undefined, maxAttempts: undefined };

  const nestedQuiz = isRecord(getRecordValue(parsed, "quiz")) ? (getRecordValue(parsed, "quiz") as JsonRecord) : null;
  const nestedData = isRecord(getRecordValue(parsed, "data")) ? (getRecordValue(parsed, "data") as JsonRecord) : null;

  const title = pickFirstDefined(
    pickTextFromRecord(parsed, ["title", "quizTitle", "name"]),
    nestedQuiz ? pickTextFromRecord(nestedQuiz, ["title", "quizTitle", "name"]) : undefined,
    nestedData ? pickTextFromRecord(nestedData, ["title", "quizTitle", "name"]) : undefined,
  );

  const course = pickFirstDefined(
    pickTextFromRecord(parsed, ["course", "courseCode", "subject"]),
    nestedQuiz ? pickTextFromRecord(nestedQuiz, ["course", "courseCode", "subject"]) : undefined,
    nestedData ? pickTextFromRecord(nestedData, ["course", "courseCode", "subject"]) : undefined,
  );

  const maxAttempts = pickFirstDefined(
    getRecordValue(parsed, "maxAttempts"),
    getRecordValue(parsed, "attemptLimit"),
    getRecordValue(parsed, "max_attempts"),
    nestedQuiz ? getRecordValue(nestedQuiz, "maxAttempts") : undefined,
    nestedData ? getRecordValue(nestedData, "maxAttempts") : undefined,
  );

  return { title, course, maxAttempts };
}

function normalizeFallbackTitle(fileName: string) {
  const withoutExtension = fileName.replace(/\.json$/i, "");
  const cleaned = withoutExtension.replace(/[_-]+/g, " ").trim();
  return cleaned || "Imported Quiz";
}

export function parseQuizUpload(rawText: string, fileName: string): ImportedQuizPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Invalid JSON. Paste valid JSON and try again.");
  }

  const questionsInput = extractQuestionsContainer(parsed);
  if (!questionsInput || questionsInput.length === 0) {
    throw new Error("No questions found. Include a `questions` array with at least one item.");
  }
  if (questionsInput.length > MAX_QUESTIONS) {
    throw new Error(`Quiz has ${questionsInput.length} questions. Maximum allowed is ${MAX_QUESTIONS}.`);
  }

  const questions: ImportedQuizQuestion[] = questionsInput.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Question ${index + 1} is not a valid object.`);

    const question = pickTextFromRecord(entry, ["questionText", "question", "prompt", "text"]);
    if (!question) throw new Error(`Question ${index + 1} is missing question text.`);

    const options = parseOptions(entry);
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
      throw new Error(
        `Question ${index + 1} must include ${MIN_OPTIONS}-${MAX_OPTIONS} options (found ${options.length}).`,
      );
    }
    if (options.some((option) => !option.trim())) {
      throw new Error(`Question ${index + 1} has empty option text.`);
    }

    let correctIndex = 0;
    try {
      correctIndex = parseCorrectIndex(entry, options);
    } catch {
      throw new Error(
        `Question ${index + 1} is missing a valid correct answer. Use correctOptionIndex, answer, or option text.`,
      );
    }

    const difficulty = normalizeDifficulty(
      pickFirstDefined(getRecordValue(entry, "difficulty"), getRecordValue(entry, "level")),
    );
    const durationSeconds = normalizeDurationSeconds(
      pickFirstDefined(
        getRecordValue(entry, "durationSeconds"),
        getRecordValue(entry, "duration"),
        getRecordValue(entry, "timeLimit"),
        getRecordValue(entry, "timeLimitSeconds"),
      ),
    );

    return { question, options, correctIndex, difficulty, durationSeconds };
  });

  const { title, course, maxAttempts } = extractMeta(parsed);
  return {
    title: normalizeTitle(title, normalizeFallbackTitle(fileName)),
    course: normalizeCourse(course),
    maxAttempts: normalizeMaxAttempts(maxAttempts),
    questions,
  };
}
