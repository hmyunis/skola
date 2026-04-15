import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { UsersService } from '../users/users.service';
import { Course } from '../academics/entities/course.entity';
import {
  Assessment,
  AssessmentStatus,
} from '../academics/entities/assessment.entity';
import { ScheduleItem } from '../academics/entities/schedule-item.entity';
import { Resource, ResourceType } from '../resources/entities/resource.entity';
import { Announcement } from '../admin/entities/announcement.entity';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { Quiz } from '../arena/entities/quiz.entity';

interface AssistantHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantClientTimeContext {
  timeZone?: string;
  locale?: string;
  nowIso?: string;
}

interface AssistantResolvedTimeContext {
  now: Date;
  timeZone: string;
  locale: string;
  localNowLabel: string;
  localDateKey: string;
}

interface CachedAnswer {
  answer: string;
  model: string;
  sources: string[];
  expiresAt: number;
}

interface ContextSnippet {
  source: string;
  text: string;
  score: number;
  priority: number;
}

interface CourseRow {
  name: string;
  code: string | null;
  instructor: string | null;
  credits: number | null;
}

interface AssessmentRow {
  title: string;
  courseCode: string;
  dueDate: string | null;
  description: string | null;
}

interface ResourceRow {
  title: string;
  type: ResourceType;
  description: string | null;
  courseCode: string | null;
  courseName: string | null;
}

interface AnnouncementRow {
  title: string;
  content: string;
  priority: string;
  createdAt: Date;
}

interface ScheduleRow {
  courseName: string | null;
  courseCode: string | null;
  type: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
  isOnline: boolean;
  isDraft: boolean;
}

interface MemberRow {
  name: string | null;
  telegramUsername: string | null;
  role: string;
  status: string;
  joinedAt: Date;
}

interface QuizRow {
  title: string;
  courseCode: string | null;
  createdAt: Date;
  questionCount: number | string | null;
}

interface ContextFetchPlan {
  includeCourses: boolean;
  includeAssessments: boolean;
  includeResources: boolean;
  includeAnnouncements: boolean;
  includeSchedules: boolean;
  includeMembers: boolean;
  includeQuizzes: boolean;
  courseCodeHints: string[];
  courseLimit: number;
  assessmentLimit: number;
  resourceLimit: number;
  announcementLimit: number;
  scheduleLimit: number;
  memberLimit: number;
  quizLimit: number;
}

interface ContextBuildResult {
  promptContext: string;
  sources: string[];
  recentQuizTips: string[];
}

interface AssistantUsageSnapshot {
  provider: 'gemini';
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  remainingRequests: number | null;
  remainingTokens: number | null;
  resetAt: string | null;
  updatedAt: string;
}

interface CompletionResult {
  answer: string;
}

export interface AssistantUsageReport {
  provider: 'gemini';
  model: string;
  byokRequired: true;
  hasPersonalApiKey: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  remainingRequests: number | null;
  remainingTokens: number | null;
  resetAt: string | null;
  fallbackResetAt: string;
  fallbackResetPolicy: string;
  updatedAt: string | null;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly responseCache = new Map<string, CachedAnswer>();
  private readonly usageSnapshots = new Map<string, AssistantUsageSnapshot>();
  private readonly cacheTtlMs = 10 * 60 * 1000;
  private readonly maxCacheEntries = 300;
  private readonly modelName = 'gemini-2.5-flash-lite';
  private readonly completionUrl =
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

  private readonly baseSuggestions = [
    'What assessments are due soon?',
    'What classes do I have on Wednesday?',
    'Who are the key members and instructors in this classroom?',
    'Are there new quizzes I should practice today?',
    'Summarize urgent announcements for this classroom.',
    'Which resources should I review for this week?',
    'Give me a quick study plan for upcoming deadlines.',
    'List pending assignments and quizzes by course.',
  ];

  constructor(
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(ScheduleItem)
    private readonly scheduleRepo: Repository<ScheduleItem>,
    @InjectRepository(Resource)
    private readonly resourceRepo: Repository<Resource>,
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
    @InjectRepository(ClassroomMember)
    private readonly classroomMemberRepo: Repository<ClassroomMember>,
    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,
    private readonly usersService: UsersService,
    private readonly httpService: HttpService,
  ) {}

  async getSuggestions(classroomId: string): Promise<{ suggestions: string[] }> {
    const upcoming = await this.assessmentRepo
      .createQueryBuilder('assessment')
      .select('assessment.title', 'title')
      .where('assessment.classroomId = :classroomId', { classroomId })
      .andWhere('assessment.status = :status', {
        status: AssessmentStatus.PENDING,
      })
      .andWhere('assessment.dueDate IS NOT NULL')
      .orderBy('assessment.dueDate', 'ASC')
      .limit(3)
      .getRawMany<{ title: string }>();

    const dynamic = upcoming
      .map((item) => this.compressText(item.title, 80))
      .filter(Boolean)
      .map((title) => `Explain this upcoming assessment: ${title}`);

    return {
      suggestions: [...dynamic, ...this.baseSuggestions].slice(0, 8),
    };
  }

  async getUsage(
    userId: string,
    classroomId: string,
  ): Promise<AssistantUsageReport> {
    const byok = await this.usersService.resolveAssistantApiKeyForUser(
      userId,
      classroomId,
    );
    const usageKey = this.usageKey(userId, classroomId);
    const snapshot = this.usageSnapshots.get(usageKey) || null;

    return {
      provider: 'gemini',
      model: this.modelName,
      byokRequired: true,
      hasPersonalApiKey: Boolean(byok.personalApiKey),
      promptTokens: snapshot?.promptTokens ?? null,
      completionTokens: snapshot?.completionTokens ?? null,
      totalTokens: snapshot?.totalTokens ?? null,
      remainingRequests: snapshot?.remainingRequests ?? null,
      remainingTokens: snapshot?.remainingTokens ?? null,
      resetAt: snapshot?.resetAt ?? null,
      fallbackResetAt: this.getNextPacificMidnightIso(),
      fallbackResetPolicy:
        'Gemini free-tier daily request quotas reset at midnight Pacific time.',
      updatedAt: snapshot?.updatedAt ?? null,
    };
  }

  async chat(
    userId: string,
    classroomId: string,
    message: string,
    history: AssistantHistoryMessage[] = [],
    clientTimeContext: AssistantClientTimeContext = {},
  ): Promise<{
    answer: string;
    model: string;
    cached: boolean;
    sources: string[];
    suggestions: string[];
  }> {
    const timeContext = this.resolveTimeContext(clientTimeContext);
    const normalizedQuestion = this.normalizeQuestion(message);
    const cacheQuestionKey = this.buildCacheQuestionKey(
      normalizedQuestion,
      timeContext,
    );
    const sanitizedHistory = this.sanitizeHistory(history);
    const directTemporalAnswer = this.buildDirectTemporalAnswer(
      normalizedQuestion,
      timeContext,
    );

    if (directTemporalAnswer) {
      return {
        answer: directTemporalAnswer,
        model: 'local-time-engine',
        cached: false,
        sources: [`Local clock (${timeContext.timeZone})`],
        suggestions: this.baseSuggestions.slice(0, 6),
      };
    }

    if (!sanitizedHistory.length) {
      const cached = this.readCache(classroomId, cacheQuestionKey);
      if (cached) {
        return {
          answer: cached.answer,
          model: cached.model,
          cached: true,
          sources: cached.sources,
          suggestions: this.baseSuggestions.slice(0, 6),
        };
      }
    }

    const apiKey = await this.resolveAssistantApiKey(userId, classroomId);
    const context = await this.buildContext(classroomId, message, timeContext);
    const reasoningEffort = this.selectReasoningEffort(message);

    const messages = [
      {
        role: 'system',
        content:
          'You are the SKOLA classroom assistant. Be very polite, respectful, and supportive in tone. Use only provided classroom context as facts. Never reference or infer information from other classrooms. Keep responses user-friendly for students, concise, and actionable. Use plain language, short sections, and bullets when helpful. Preserve clean markdown formatting when useful, including line breaks and indentation for lists/code snippets. Always provide complete answers and do not end abruptly after an intro line or heading. When mentioning dates/times, always format them in natural locale style (for example: Apr 14, 2026 at 3:30 PM) and include relative context when helpful (for example: tomorrow or in 2 days). Do not start with meta phrases like "Based on the provided context", "According to the context", or similar. Start directly with the helpful answer. If context is missing, say exactly what is missing and where to find it in SKOLA.',
      },
      {
        role: 'system',
        content: this.buildTimeContextSystemMessage(timeContext),
      },
      {
        role: 'system',
        content: `Classroom context (compressed):\n${context.promptContext}`,
      },
      ...sanitizedHistory,
      {
        role: 'user',
        content: this.compressText(message, 700),
      },
    ];

    const completion = await this.requestAssistantCompletion(
      userId,
      classroomId,
      apiKey,
      messages,
      reasoningEffort,
    );

    const polishedAnswer = this.polishAssistantAnswer(completion.answer || '');
    const enhancedAnswer = this.attachQuizRecommendationIfNeeded(
      polishedAnswer,
      message,
      context.recentQuizTips,
    );
    const safeAnswer =
      this.truncatePreservingFormatting(enhancedAnswer, 4000) ||
      'I could not generate a reliable answer from the current classroom context.';

    if (!sanitizedHistory.length) {
      this.writeCache(classroomId, cacheQuestionKey, {
        answer: safeAnswer,
        model: this.modelName,
        sources: context.sources,
      });
    }

    return {
      answer: safeAnswer,
      model: this.modelName,
      cached: false,
      sources: context.sources,
      suggestions: this.baseSuggestions.slice(0, 6),
    };
  }

  private async resolveAssistantApiKey(
    userId: string,
    classroomId: string,
  ): Promise<string> {
    const byok = await this.usersService.resolveAssistantApiKeyForUser(
      userId,
      classroomId,
    );

    if (!byok.personalApiKey) {
      throw new BadRequestException(
        'Assistant BYOK key is required. Open Settings > BYOK and add your Gemini API key.',
      );
    }

    return byok.personalApiKey;
  }

  private async buildContext(
    classroomId: string,
    question: string,
    timeContext: AssistantResolvedTimeContext,
  ): Promise<ContextBuildResult> {
    const keywords = this.extractKeywords(question);
    const plan = this.buildContextPlan(question, keywords);

    const [
      courses,
      assessments,
      schedules,
      resources,
      announcements,
      members,
      quizzes,
    ] =
      await Promise.all([
        this.fetchCourses(classroomId, plan),
        this.fetchAssessments(classroomId, plan),
        this.fetchSchedules(classroomId, plan),
        this.fetchResources(classroomId, plan),
        this.fetchAnnouncements(classroomId, plan, timeContext),
        this.fetchMembers(classroomId, plan),
        this.fetchQuizzes(classroomId, plan),
      ]);

    const snippets: ContextSnippet[] = [];

    for (const row of courses) {
      const label = row.code
        ? `${row.code} - ${row.name}`
        : this.compressText(row.name, 80);
      const text = this.compressText(
        `Course: ${label}. Instructor: ${row.instructor || 'TBA'}. Credits: ${row.credits ?? 'N/A'}.`,
        190,
      );
      snippets.push({
        source: `Course ${label}`,
        text,
        score: this.scoreText(text, keywords),
        priority: 1,
      });
    }

    for (const row of assessments) {
      const dueText = this.formatDateHuman(row.dueDate, timeContext);
      const text = this.compressText(
        `Assessment: ${row.title} (${row.courseCode}) due ${dueText}. ${row.description || ''}`,
        220,
      );
      snippets.push({
        source: `Assessment ${row.title}`,
        text,
        score: this.scoreText(text, keywords),
        priority: 0,
      });
    }

    for (const row of schedules) {
      const dayLabel = this.getDayName(row.dayOfWeek);
      const start = this.formatScheduleTime(row.startTime, timeContext);
      const end = this.formatScheduleTime(row.endTime, timeContext);
      const courseLabel = row.courseCode
        ? `${row.courseCode} - ${row.courseName || 'Untitled Course'}`
        : row.courseName || 'Untitled Course';
      const text = this.compressText(
        `Schedule: ${courseLabel} (${String(row.type || 'lecture').toUpperCase()}) on ${dayLabel} ${start} to ${end}. Location: ${row.isOnline ? 'Online' : row.location || 'TBA'}.`,
        230,
      );
      snippets.push({
        source: `Schedule ${courseLabel}`,
        text,
        score: this.scoreText(text, keywords),
        priority: 0,
      });
    }

    for (const row of resources) {
      const courseLabel =
        row.courseCode || row.courseName || 'Unlinked course resource';
      const text = this.compressText(
        `Resource: ${row.title}. Type: ${row.type}. Course: ${courseLabel}. ${row.description || ''}`,
        210,
      );
      snippets.push({
        source: `Resource ${row.title}`,
        text,
        score: this.scoreText(text, keywords),
        priority: 2,
      });
    }

    for (const row of announcements) {
      const publishedAt = this.formatDateTimeHuman(row.createdAt, timeContext);
      const text = this.compressText(
        `Announcement (${String(row.priority).toUpperCase()}): ${row.title}. Published ${publishedAt}. ${row.content}`,
        260,
      );
      snippets.push({
        source: `Announcement ${row.title}`,
        text,
        score: this.scoreText(text, keywords),
        priority: -1,
      });
    }

    const recentQuizTips = quizzes
      .filter((row) => this.isRecent(row.createdAt, 14))
      .slice(0, 3)
      .map((row) => {
        const createdAt = this.formatDateTimeHuman(row.createdAt, timeContext);
        const course = row.courseCode || 'General';
        return `${row.title} (${course}, added ${createdAt})`;
      });

    for (const row of quizzes) {
      const addedAt = this.formatDateTimeHuman(row.createdAt, timeContext);
      const course = row.courseCode || 'General';
      const questionCountValue = Number(row.questionCount || 0);
      const questionCount =
        Number.isFinite(questionCountValue) && questionCountValue > 0
          ? `${questionCountValue} questions`
          : 'question count unavailable';
      const text = this.compressText(
        `Quiz: ${row.title}. Course: ${course}. Added ${addedAt}. ${questionCount}.`,
        210,
      );
      snippets.push({
        source: `Quiz ${row.title}`,
        text,
        score: this.scoreText(text, keywords),
        priority: 1,
      });
    }

    for (const row of members) {
      const username = row.telegramUsername
        ? `@${String(row.telegramUsername).replace(/^@+/, '')}`
        : 'no username';
      const text = this.compressText(
        `Member: ${row.name || 'Unknown'}. Role: ${String(row.role).toLowerCase()}. Status: ${String(row.status).toLowerCase()}. Telegram: ${username}.`,
        190,
      );
      snippets.push({
        source: 'Classroom member',
        text,
        score: this.scoreText(text, keywords),
        priority: 2,
      });
    }

    if (members.length > 0) {
      const owners = members.filter((row) => row.role === 'owner').length;
      const admins = members.filter((row) => row.role === 'admin').length;
      const students = members.filter((row) => row.role === 'student').length;
      const active = members.filter((row) => row.status === 'active').length;
      const text = this.compressText(
        `Member summary: ${members.length} members listed. Active: ${active}. Owners: ${owners}. Admins: ${admins}. Students: ${students}.`,
        180,
      );
      snippets.push({
        source: 'Member summary',
        text,
        score: this.scoreText(text, keywords),
        priority: 1,
      });
    }

    const ranked = snippets.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.priority - b.priority;
    });

    const selected: ContextSnippet[] = [];
    let usedChars = 0;
    const maxChars = 2400;

    for (const snippet of ranked) {
      if (!snippet.text) continue;
      if (keywords.length > 0 && snippet.score <= 0 && selected.length >= 5) {
        continue;
      }
      const nextLength = snippet.text.length + 12;
      if (usedChars + nextLength > maxChars) continue;
      selected.push(snippet);
      usedChars += nextLength;
      if (selected.length >= 12) break;
    }

    if (!selected.length) {
      selected.push(
        ...ranked.slice(0, 5).filter((item) => Boolean(item.text.trim())),
      );
    }

    const contextLines = selected.map((item) => `- ${item.text}`);
    const sources = Array.from(
      new Set(selected.map((item) => item.source).filter(Boolean)),
    ).slice(0, 8);

    return {
      promptContext: contextLines.join('\n'),
      sources,
      recentQuizTips,
    };
  }

  private fetchCourses(classroomId: string, plan: ContextFetchPlan) {
    if (!plan.includeCourses) return Promise.resolve([] as CourseRow[]);

    return this.courseRepo
      .createQueryBuilder('course')
      .select('course.name', 'name')
      .addSelect('course.code', 'code')
      .addSelect('course.instructor', 'instructor')
      .addSelect('course.credits', 'credits')
      .where('course.classroomId = :classroomId', { classroomId })
      .orderBy('course.createdAt', 'DESC')
      .limit(plan.courseLimit)
      .getRawMany<CourseRow>();
  }

  private fetchAssessments(classroomId: string, plan: ContextFetchPlan) {
    if (!plan.includeAssessments) return Promise.resolve([] as AssessmentRow[]);

    const query = this.assessmentRepo
      .createQueryBuilder('assessment')
      .select('assessment.title', 'title')
      .addSelect('assessment.courseCode', 'courseCode')
      .addSelect('assessment.dueDate', 'dueDate')
      .addSelect('assessment.description', 'description')
      .where('assessment.classroomId = :classroomId', { classroomId })
      .andWhere('assessment.status = :status', {
        status: AssessmentStatus.PENDING,
      });

    if (plan.courseCodeHints.length > 0) {
      query.andWhere(
        "REPLACE(UPPER(assessment.courseCode), '-', '') IN (:...courseCodeHints)",
        {
          courseCodeHints: plan.courseCodeHints,
        },
      );
    }

    return query
      .orderBy('assessment.dueDate IS NULL', 'ASC')
      .addOrderBy('assessment.dueDate', 'ASC')
      .addOrderBy('assessment.createdAt', 'DESC')
      .limit(plan.assessmentLimit)
      .getRawMany<AssessmentRow>();
  }

  private fetchSchedules(classroomId: string, plan: ContextFetchPlan) {
    if (!plan.includeSchedules) return Promise.resolve([] as ScheduleRow[]);

    const query = this.scheduleRepo
      .createQueryBuilder('schedule')
      .innerJoin('schedule.course', 'course')
      .select('course.name', 'courseName')
      .addSelect('course.code', 'courseCode')
      .addSelect('schedule.type', 'type')
      .addSelect('schedule.dayOfWeek', 'dayOfWeek')
      .addSelect('schedule.startTime', 'startTime')
      .addSelect('schedule.endTime', 'endTime')
      .addSelect('schedule.location', 'location')
      .addSelect('schedule.isOnline', 'isOnline')
      .addSelect('schedule.isDraft', 'isDraft')
      .where('course.classroomId = :classroomId', { classroomId })
      .andWhere('schedule.isDraft = :isDraft', { isDraft: false });

    if (plan.courseCodeHints.length > 0) {
      query.andWhere("REPLACE(UPPER(course.code), '-', '') IN (:...courseCodeHints)", {
        courseCodeHints: plan.courseCodeHints,
      });
    }

    return query
      .orderBy('schedule.dayOfWeek', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .limit(plan.scheduleLimit)
      .getRawMany<ScheduleRow>();
  }

  private fetchResources(classroomId: string, plan: ContextFetchPlan) {
    if (!plan.includeResources) return Promise.resolve([] as ResourceRow[]);

    const query = this.resourceRepo
      .createQueryBuilder('resource')
      .leftJoin('resource.course', 'course')
      .select('resource.title', 'title')
      .addSelect('resource.type', 'type')
      .addSelect('resource.description', 'description')
      .addSelect('course.code', 'courseCode')
      .addSelect('course.name', 'courseName')
      .where('resource.classroomId = :classroomId', { classroomId });

    if (plan.courseCodeHints.length > 0) {
      query.andWhere("REPLACE(UPPER(course.code), '-', '') IN (:...courseCodeHints)", {
        courseCodeHints: plan.courseCodeHints,
      });
    }

    return query
      .orderBy('resource.updatedAt', 'DESC')
      .limit(plan.resourceLimit)
      .getRawMany<ResourceRow>();
  }

  private fetchAnnouncements(
    classroomId: string,
    plan: ContextFetchPlan,
    timeContext: AssistantResolvedTimeContext,
  ) {
    if (!plan.includeAnnouncements)
      return Promise.resolve([] as AnnouncementRow[]);

    return this.announcementRepo
      .createQueryBuilder('announcement')
      .select('announcement.title', 'title')
      .addSelect('announcement.content', 'content')
      .addSelect('announcement.priority', 'priority')
      .addSelect('announcement.createdAt', 'createdAt')
      .where('announcement.classroomId = :classroomId', { classroomId })
      .andWhere(
        '(announcement.expiresAt IS NULL OR announcement.expiresAt > :now)',
        { now: timeContext.now },
      )
      .orderBy('announcement.pinned', 'DESC')
      .addOrderBy('announcement.createdAt', 'DESC')
      .limit(plan.announcementLimit)
      .getRawMany<AnnouncementRow>();
  }

  private fetchMembers(classroomId: string, plan: ContextFetchPlan) {
    if (!plan.includeMembers) return Promise.resolve([] as MemberRow[]);

    return this.classroomMemberRepo
      .createQueryBuilder('member')
      .leftJoin('member.user', 'user')
      .select('user.name', 'name')
      .addSelect('user.telegramUsername', 'telegramUsername')
      .addSelect('member.role', 'role')
      .addSelect('member.status', 'status')
      .addSelect('member.joinedAt', 'joinedAt')
      .where('member.classroomId = :classroomId', { classroomId })
      .orderBy(
        "CASE member.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END",
        'ASC',
      )
      .addOrderBy('member.joinedAt', 'ASC')
      .limit(plan.memberLimit)
      .getRawMany<MemberRow>();
  }

  private fetchQuizzes(classroomId: string, plan: ContextFetchPlan) {
    if (!plan.includeQuizzes) return Promise.resolve([] as QuizRow[]);

    const query = this.quizRepo
      .createQueryBuilder('quiz')
      .select('quiz.title', 'title')
      .addSelect('quiz.courseCode', 'courseCode')
      .addSelect('quiz.createdAt', 'createdAt')
      .addSelect(
        (subQuery) =>
          subQuery
            .select('COUNT(question.id)')
            .from('quiz_questions', 'question')
            .where('question.quizId = quiz.id'),
        'questionCount',
      )
      .where('quiz.classroomId = :classroomId', { classroomId })
      .andWhere('quiz.isPublished = :isPublished', { isPublished: true });

    if (plan.courseCodeHints.length > 0) {
      query.andWhere(
        "REPLACE(UPPER(quiz.courseCode), '-', '') IN (:...courseCodeHints)",
        {
          courseCodeHints: plan.courseCodeHints,
        },
      );
    }

    return query
      .orderBy('quiz.createdAt', 'DESC')
      .limit(plan.quizLimit)
      .getRawMany<QuizRow>();
  }

  private buildContextPlan(
    question: string,
    keywords: string[],
  ): ContextFetchPlan {
    const q = question.toLowerCase();
    const mentions = {
      assessments:
        /(assessment|assessments|assignment|assignments|deadline|deadlines|due|exam|quiz|project)/.test(
          q,
        ),
      announcements:
        /(announcement|announcements|notice|notices|urgent|important|update|updates)/.test(
          q,
        ),
      resources:
        /(resource|resources|slide|slides|note|notes|ebook|file|material|materials|reference|references)/.test(
          q,
        ),
      courses:
        /(course|courses|instructor|teacher|credits|semester|class)/.test(q),
      schedules:
        /(schedule|timetable|time table|class time|class times|weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.test(
          q,
        ),
      members:
        /(member|members|student|students|classmate|classmates|who is in|roster|people|participants)/.test(
          q,
        ),
      quizzes:
        /(quiz|quizzes|exam|exams|test|tests|practice quiz|mock)/.test(q),
    };

    const hasExplicitIntent = Object.values(mentions).some(Boolean);
    const includeCourses = hasExplicitIntent
      ? mentions.courses ||
        mentions.schedules ||
        mentions.assessments ||
        mentions.resources ||
        mentions.quizzes
      : true;
    const includeAssessments = hasExplicitIntent
      ? mentions.assessments
      : true;
    const includeResources = hasExplicitIntent
      ? mentions.resources
      : false;
    const includeAnnouncements = hasExplicitIntent
      ? mentions.announcements
      : false;
    const includeSchedules = hasExplicitIntent
      ? mentions.schedules || mentions.courses
      : true;
    const includeMembers = hasExplicitIntent
      ? mentions.members
      : false;
    const includeQuizzes = hasExplicitIntent
      ? mentions.quizzes || mentions.assessments
      : false;

    const complexityBoost = question.length > 180 || keywords.length > 8 ? 1 : 0;

    return {
      includeCourses,
      includeAssessments,
      includeResources,
      includeAnnouncements,
      includeSchedules,
      includeMembers,
      includeQuizzes,
      courseCodeHints: this.extractCourseCodeHints(question),
      courseLimit: includeCourses ? 8 + complexityBoost * 2 : 0,
      assessmentLimit: includeAssessments ? 8 + complexityBoost * 3 : 0,
      resourceLimit: includeResources ? 6 + complexityBoost * 2 : 0,
      announcementLimit: includeAnnouncements ? 5 + complexityBoost * 1 : 0,
      scheduleLimit: includeSchedules ? 14 + complexityBoost * 4 : 0,
      memberLimit: includeMembers ? 18 + complexityBoost * 4 : 0,
      quizLimit: includeQuizzes ? 10 + complexityBoost * 3 : 0,
    };
  }

  private extractCourseCodeHints(question: string): string[] {
    const matches = String(question || '')
      .toUpperCase()
      .match(/[A-Z]{2,6}\s*-?\s*\d{2,4}[A-Z]?/g);

    if (!matches) return [];

    return Array.from(
      new Set(matches.map((value) => value.replace(/[^A-Z0-9]/g, '').trim())),
    ).slice(0, 5);
  }

  private selectReasoningEffort(
    question: string,
  ): 'none' | 'low' | 'medium' | 'high' {
    const normalized = String(question || '').toLowerCase();
    const complexSignals = [
      'compare',
      'analyze',
      'analysis',
      'strategy',
      'plan',
      'roadmap',
      'tradeoff',
      'pros and cons',
      'explain why',
      'diagnose',
      'debug',
    ];

    const hasComplexSignal = complexSignals.some((signal) =>
      normalized.includes(signal),
    );

    if (question.length >= 260 || hasComplexSignal) {
      return 'low';
    }

    return 'none';
  }

  private async requestAssistantCompletion(
    userId: string,
    classroomId: string,
    apiKey: string,
    messages: Array<{ role: string; content: string }>,
    reasoningEffort: 'none' | 'low' | 'medium' | 'high',
  ): Promise<CompletionResult> {
    try {
      const basePayload = {
        model: this.modelName,
        temperature: 0.2,
        max_tokens: 650,
        messages,
      };

      const response = await this.requestCompletionWithFallback(
        apiKey,
        basePayload,
        reasoningEffort,
      );

      const content = this.extractAssistantText(response?.data);
      const finishReason = this.extractFinishReason(response?.data);
      let fullContent = content;

      if (
        this.shouldAutoContinueAnswer(content, finishReason) &&
        content.trim().length > 0
      ) {
        const continuationMessages = [
          ...messages,
          {
            role: 'assistant',
            content: this.truncatePreservingFormatting(content, 2500),
          },
          {
            role: 'user',
            content:
              'Continue exactly from where you stopped. Do not repeat previous lines. Keep it concise and complete.',
          },
        ];

        const continuationResponse = await this.requestCompletionWithFallback(
          apiKey,
          {
            ...basePayload,
            max_tokens: 420,
            messages: continuationMessages,
          },
          'low',
        );

        const continuationText = this.extractAssistantText(
          continuationResponse?.data,
        );
        if (continuationText) {
          fullContent = this.mergeContinuation(content, continuationText);
        }
      }

      const usageSnapshot = this.buildUsageSnapshot(
        response?.data,
        response?.headers,
      );
      this.writeUsageSnapshot(userId, classroomId, usageSnapshot);

      return {
        answer: fullContent,
      };
    } catch (error: any) {
      const detail = error?.response?.data || error?.message || String(error);
      this.logger.error('Assistant completion request failed', detail);

      if (this.isQuotaLimitError(error)) {
        const retryAfter = this.extractRetryDelaySeconds(error);
        const retryText =
          retryAfter !== null
            ? ` Please retry in about ${retryAfter} seconds.`
            : '';
        throw new HttpException(
          `You have reached your Gemini API quota limit for now.${retryText} Check your usage or billing in Google AI Studio.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException(
        'Assistant request failed. Verify your Gemini BYOK key and try again.',
      );
    }
  }

  private async requestCompletionWithFallback(
    apiKey: string,
    basePayload: Record<string, unknown>,
    reasoningEffort: 'none' | 'low' | 'medium' | 'high',
  ) {
    const requestConfig = {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    };

    try {
      return await firstValueFrom(
        this.httpService.post(
          this.completionUrl,
          {
            ...basePayload,
            reasoning_effort: reasoningEffort,
          },
          requestConfig,
        ),
      );
    } catch (error: any) {
      if (!this.isReasoningEffortUnsupported(error)) throw error;
      return await firstValueFrom(
        this.httpService.post(this.completionUrl, basePayload, requestConfig),
      );
    }
  }

  private extractAssistantText(payload: any): string {
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content.trim();

    if (Array.isArray(content)) {
      return content
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (typeof entry?.text === 'string') return entry.text;
          return '';
        })
        .join(' ')
        .trim();
    }

    return '';
  }

  private extractFinishReason(payload: any): string | null {
    const raw = payload?.choices?.[0]?.finish_reason;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed || null;
  }

  private shouldAutoContinueAnswer(
    answer: string,
    finishReason: string | null,
  ): boolean {
    const text = String(answer || '').trim();
    if (!text) return false;
    if (finishReason && finishReason.toLowerCase() === 'length') return true;

    const trailingSignals = [/[:\-]\s*$/, /\b(here (are|is).*)$/i];
    return trailingSignals.some((pattern) => pattern.test(text));
  }

  private mergeContinuation(base: string, continuation: string): string {
    const left = String(base || '').trimEnd();
    const right = String(continuation || '').trimStart();
    if (!left) return right;
    if (!right) return left;

    const normalizedLeft = left.toLowerCase();
    const normalizedRight = right.toLowerCase();
    if (normalizedLeft.endsWith(normalizedRight)) return left;

    return `${left}\n${right}`;
  }

  private polishAssistantAnswer(answer: string): string {
    let output = String(answer || '').trim();
    if (!output) return '';

    const leadingMetaPatterns = [
      /^(based on (the )?(provided |available )?context[,:\-\s]*)/i,
      /^(according to (the )?(provided |available )?context[,:\-\s]*)/i,
      /^(from (the )?(provided |available )?context[,:\-\s]*)/i,
      /^(given (the )?(provided |available )?context[,:\-\s]*)/i,
    ];

    for (const pattern of leadingMetaPatterns) {
      output = output.replace(pattern, '').trim();
    }

    output = output.replace(/^[,:\-\u2014]+\s*/, '').trim();
    return output;
  }

  private attachQuizRecommendationIfNeeded(
    answer: string,
    question: string,
    recentQuizTips: string[],
  ): string {
    const output = String(answer || '').trim();
    if (!output) return output;
    if (!this.isQuizOrExamQuestion(question)) return output;
    if (!Array.isArray(recentQuizTips) || recentQuizTips.length === 0) {
      return output;
    }

    const normalized = output.toLowerCase();
    const hasQuizNudge =
      normalized.includes('practice tip') ||
      normalized.includes('take a quiz') ||
      normalized.includes('take quizzes') ||
      normalized.includes('try this quiz') ||
      normalized.includes('try these quizzes');

    if (hasQuizNudge) return output;

    const picks = recentQuizTips
      .slice(0, 2)
      .map((tip) => `- ${tip}`)
      .join('\n');

    return `${output}\n\nPractice tip:\nNew quizzes were added recently in this classroom. Consider taking:\n${picks}`;
  }

  private isQuizOrExamQuestion(question: string): boolean {
    const q = String(question || '').toLowerCase();
    return /(quiz|quizzes|exam|exams|test|tests|practice)/.test(q);
  }

  private getDayName(dayOfWeek: number): string {
    const names = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const numeric = Number(dayOfWeek);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 6) {
      return 'Unknown day';
    }
    return names[numeric] || 'Unknown day';
  }

  private formatScheduleTime(
    timeValue: string,
    timeContext: AssistantResolvedTimeContext,
  ): string {
    const match = String(timeValue || '').match(/^(\d{1,2}):(\d{2})/);
    if (!match) return String(timeValue || 'TBA');

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 'TBA';
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return 'TBA';

    const utcAnchor = new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
    return utcAnchor.toLocaleTimeString(timeContext.locale, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  }

  private isRecent(value: Date | string | null | undefined, days: number): boolean {
    if (!value) return false;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return false;
    const ageMs = Date.now() - date.getTime();
    return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
  }

  private isReasoningEffortUnsupported(error: any): boolean {
    const status = Number(error?.response?.status || 0);
    if (status !== 400) return false;

    const rawMessage =
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      '';
    const message = String(rawMessage).toLowerCase();
    return message.includes('reasoning_effort');
  }

  private isQuotaLimitError(error: any): boolean {
    const statusCode = Number(error?.response?.status || 0);
    const payload = error?.response?.data;
    const nested = Array.isArray(payload) ? payload[0] : payload;
    const code = Number(nested?.error?.code || 0);
    const status = String(nested?.error?.status || '').toUpperCase();
    const message = String(nested?.error?.message || '').toLowerCase();

    if (statusCode === 429 || code === 429) return true;
    if (status === 'RESOURCE_EXHAUSTED') return true;
    if (message.includes('quota exceeded')) return true;
    if (message.includes('rate limit')) return true;
    return false;
  }

  private extractRetryDelaySeconds(error: any): number | null {
    const payload = error?.response?.data;
    const nested = Array.isArray(payload) ? payload[0] : payload;
    const details = nested?.error?.details;

    if (Array.isArray(details)) {
      for (const detail of details) {
        const retryDelay = String(detail?.retryDelay || '').trim();
        const fromRetryDetail = this.parseRetryDelaySeconds(retryDelay);
        if (fromRetryDetail !== null) return fromRetryDetail;
      }
    }

    const message = String(nested?.error?.message || '');
    const inline = message.match(/retry in\s+([\d.]+)\s*s/i);
    if (inline) {
      const seconds = Math.ceil(Number(inline[1]));
      if (Number.isFinite(seconds) && seconds > 0) return seconds;
    }

    return null;
  }

  private parseRetryDelaySeconds(value: string): number | null {
    if (!value) return null;
    const match = String(value).trim().match(/^([\d.]+)\s*s$/i);
    if (!match) return null;
    const seconds = Math.ceil(Number(match[1]));
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    return seconds;
  }

  private buildUsageSnapshot(
    payload: any,
    headers: Record<string, any> | undefined,
  ): AssistantUsageSnapshot {
    const promptTokens = this.toNullableNumber(
      payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens,
    );
    const completionTokens = this.toNullableNumber(
      payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens,
    );
    const totalTokens = this.toNullableNumber(payload?.usage?.total_tokens);

    const remainingRequests = this.parseHeaderNumber(headers, [
      'x-ratelimit-remaining-requests',
      'x-ratelimit-remaining-request',
      'x-google-ratelimit-remaining-requests',
      'x-goog-ratelimit-remaining-requests',
    ]);

    const remainingTokens = this.parseHeaderNumber(headers, [
      'x-ratelimit-remaining-tokens',
      'x-google-ratelimit-remaining-tokens',
      'x-goog-ratelimit-remaining-tokens',
    ]);

    const resetAt = this.parseResetHeaderToIso(headers, [
      'x-ratelimit-reset-requests',
      'x-ratelimit-reset-request',
      'x-ratelimit-reset-tokens',
      'x-google-ratelimit-reset-requests',
      'x-goog-ratelimit-reset-requests',
    ]);

    return {
      provider: 'gemini',
      model: this.modelName,
      promptTokens,
      completionTokens,
      totalTokens,
      remainingRequests,
      remainingTokens,
      resetAt,
      updatedAt: new Date().toISOString(),
    };
  }

  private parseHeaderNumber(
    headers: Record<string, any> | undefined,
    keys: string[],
  ): number | null {
    for (const key of keys) {
      const raw = this.readHeader(headers, key);
      if (!raw) continue;

      if (/^\d+$/.test(raw)) {
        const value = Number(raw);
        if (Number.isFinite(value)) return value;
      }

      const match = raw.match(/\d+/);
      if (match) {
        const value = Number(match[0]);
        if (Number.isFinite(value)) return value;
      }
    }

    return null;
  }

  private parseResetHeaderToIso(
    headers: Record<string, any> | undefined,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const raw = this.readHeader(headers, key);
      if (!raw) continue;

      if (/^\d+$/.test(raw)) {
        const value = Number(raw);
        if (!Number.isFinite(value)) continue;

        if (value > 10_000_000_000) {
          return new Date(value).toISOString();
        }

        if (value > 1_000_000_000) {
          return new Date(value * 1000).toISOString();
        }

        return new Date(Date.now() + value * 1000).toISOString();
      }

      const durationMatch = raw.match(/^(\d+)\s*(ms|s|m|h|d)$/i);
      if (durationMatch) {
        const amount = Number(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        const multiplier =
          unit === 'ms'
            ? 1
            : unit === 's'
              ? 1000
              : unit === 'm'
                ? 60_000
                : unit === 'h'
                  ? 3_600_000
                  : 86_400_000;

        return new Date(Date.now() + amount * multiplier).toISOString();
      }

      const parsedDate = Date.parse(raw);
      if (!Number.isNaN(parsedDate)) {
        return new Date(parsedDate).toISOString();
      }
    }

    return null;
  }

  private readHeader(
    headers: Record<string, any> | undefined,
    key: string,
  ): string | null {
    if (!headers) return null;

    const lower = key.toLowerCase();
    const raw = headers[lower] ?? headers[key];

    if (raw === undefined || raw === null) return null;
    if (Array.isArray(raw)) {
      if (!raw.length) return null;
      const first = String(raw[0] || '').trim();
      return first || null;
    }

    const value = String(raw).trim();
    return value || null;
  }

  private toNullableNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private usageKey(userId: string, classroomId: string): string {
    return `${userId}::${classroomId}`;
  }

  private writeUsageSnapshot(
    userId: string,
    classroomId: string,
    snapshot: AssistantUsageSnapshot,
  ) {
    const key = this.usageKey(userId, classroomId);
    this.usageSnapshots.set(key, snapshot);

    if (this.usageSnapshots.size <= 1000) return;

    const firstKey = this.usageSnapshots.keys().next().value as
      | string
      | undefined;
    if (firstKey) {
      this.usageSnapshots.delete(firstKey);
    }
  }

  private resolveTimeContext(
    input: AssistantClientTimeContext,
  ): AssistantResolvedTimeContext {
    const timeZone = this.normalizeTimeZone(input?.timeZone) || 'UTC';
    const locale = this.normalizeLocale(input?.locale) || 'en-US';
    const now = this.parseIsoDateTime(input?.nowIso) || new Date();
    const localDateKey = this.toTimeZoneDateKey(now, timeZone);
    const localNowLabel = now.toLocaleString(locale, {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    return {
      now,
      timeZone,
      locale,
      localNowLabel,
      localDateKey,
    };
  }

  private buildTimeContextSystemMessage(
    timeContext: AssistantResolvedTimeContext,
  ): string {
    return `Current user local time: ${timeContext.localNowLabel} (${timeContext.timeZone}). Local date: ${timeContext.localDateKey}. Interpret relative dates (today, tomorrow, this week, next week) using this local time. If the user asks for the current time or date, answer using this clock reference and never claim you lack real-time access.`;
  }

  private buildCacheQuestionKey(
    normalizedQuestion: string,
    timeContext: AssistantResolvedTimeContext,
  ): string {
    if (!normalizedQuestion) return normalizedQuestion;
    return `${normalizedQuestion}::${timeContext.timeZone}::${timeContext.localDateKey}`;
  }

  private parseIsoDateTime(value: string | undefined): Date | null {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  private normalizeTimeZone(value: string | undefined): string | null {
    const raw = String(value || '').trim();
    if (!raw) return null;

    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: raw,
      }).resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }

  private normalizeLocale(value: string | undefined): string | null {
    const raw = String(value || '').trim();
    if (!raw) return null;

    try {
      const canonical = Intl.getCanonicalLocales(raw)[0];
      return canonical || null;
    } catch {
      return null;
    }
  }

  private toTimeZoneDateKey(date: Date, timeZone: string): string {
    const parts = this.getTimeZoneDateParts(date, timeZone);
    const year = String(parts.year).padStart(4, '0');
    const month = String(parts.month).padStart(2, '0');
    const day = String(parts.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getNextPacificMidnightIso(now: Date = new Date()): string {
    const pacificParts = this.getTimeZoneDateParts(now, 'America/Los_Angeles');
    const nextDayUtcAnchor = Date.UTC(
      pacificParts.year,
      pacificParts.month - 1,
      pacificParts.day + 1,
      0,
      0,
      0,
    );

    const offsetMinutes = this.getTimeZoneOffsetMinutes(
      new Date(nextDayUtcAnchor),
      'America/Los_Angeles',
    );

    return new Date(nextDayUtcAnchor - offsetMinutes * 60_000).toISOString();
  }

  private getTimeZoneDateParts(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const read = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value || 0);

    return {
      year: read('year'),
      month: read('month'),
      day: read('day'),
      hour: read('hour'),
      minute: read('minute'),
      second: read('second'),
    };
  }

  private getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
    const parts = this.getTimeZoneDateParts(date, timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );

    return Math.round((asUtc - date.getTime()) / 60_000);
  }

  private sanitizeHistory(
    history: AssistantHistoryMessage[],
  ): Array<{ role: 'user'; content: string }> {
    if (!Array.isArray(history) || !history.length) return [];

    return history
      .slice(-4)
      .filter((item) => item?.role === 'user')
      .map((item) => ({
        role: 'user' as const,
        content: this.compressText(String(item?.content || ''), 220),
      }))
      .filter((item) => Boolean(item.content));
  }

  private normalizeQuestion(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildDirectTemporalAnswer(
    normalizedQuestion: string,
    timeContext: AssistantResolvedTimeContext,
  ): string | null {
    const question = String(normalizedQuestion || '');
    if (!question) return null;

    const asksCurrentTime =
      /\bwhat time is it\b/.test(question) ||
      /\bcurrent time\b/.test(question) ||
      /\btime now\b/.test(question) ||
      /\blocal time\b/.test(question) ||
      /\btime right now\b/.test(question) ||
      /\btell me (the )?time\b/.test(question);

    const asksCurrentDate =
      /\bcurrent date\b/.test(question) ||
      /\btoday'?s date\b/.test(question) ||
      /\bwhat day is it\b/.test(question) ||
      /\bwhat is today'?s date\b/.test(question);

    if (!asksCurrentTime && !asksCurrentDate) return null;

    const dateLabel = timeContext.now.toLocaleDateString(timeContext.locale, {
      timeZone: timeContext.timeZone,
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeLabel = timeContext.now.toLocaleTimeString(timeContext.locale, {
      timeZone: timeContext.timeZone,
      hour: 'numeric',
      minute: '2-digit',
    });

    if (asksCurrentTime && asksCurrentDate) {
      return `Current local date and time: ${dateLabel} at ${timeLabel} (${timeContext.timeZone}).`;
    }
    if (asksCurrentTime) {
      return `Current local time: ${timeLabel} (${timeContext.timeZone}).`;
    }
    return `Today's local date: ${dateLabel} (${timeContext.timeZone}).`;
  }

  private truncatePreservingFormatting(value: string, limit: number): string {
    const normalized = String(value || '').replace(/\r\n/g, '\n').trim();
    if (normalized.length <= limit) return normalized;
    if (limit <= 3) return normalized.slice(0, limit);
    return `${normalized.slice(0, limit - 3).trimEnd()}...`;
  }

  private compressText(value: string, limit: number): string {
    const compact = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (compact.length <= limit) return compact;
    if (limit <= 3) return compact.slice(0, limit);
    return `${compact.slice(0, limit - 3)}...`;
  }

  private formatDateHuman(
    value: string | Date | null | undefined,
    timeContext: AssistantResolvedTimeContext,
  ): string {
    if (!value) return 'TBA';

    const raw = String(value).trim();
    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const parsed = value instanceof Date ? value : new Date(raw);
    const dateToFormat = dateOnly
      ? new Date(
          Date.UTC(
            Number(dateOnly[1]),
            Number(dateOnly[2]) - 1,
            Number(dateOnly[3]),
            12,
            0,
            0,
            0,
          ),
        )
      : parsed;

    if (Number.isNaN(dateToFormat.getTime())) return 'TBA';

    return dateToFormat.toLocaleDateString(timeContext.locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: dateOnly ? 'UTC' : timeContext.timeZone,
    });
  }

  private formatDateTimeHuman(
    value: string | Date | null | undefined,
    timeContext: AssistantResolvedTimeContext,
  ): string {
    if (!value) return 'unknown time';
    const parsed = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return 'unknown time';
    return parsed.toLocaleString(timeContext.locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeContext.timeZone,
    });
  }

  private extractKeywords(question: string): string[] {
    const stopwords = new Set([
      'what',
      'when',
      'where',
      'which',
      'who',
      'why',
      'how',
      'the',
      'and',
      'for',
      'with',
      'that',
      'this',
      'from',
      'into',
      'about',
      'have',
      'has',
      'are',
      'you',
      'your',
      'our',
      'their',
      'been',
      'will',
      'would',
      'could',
      'should',
      'can',
      'give',
      'tell',
      'show',
      'help',
      'please',
    ]);

    return Array.from(
      new Set(
        String(question || '')
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .map((token) => token.trim())
          .filter((token) => token.length >= 3 && !stopwords.has(token)),
      ),
    ).slice(0, 16);
  }

  private scoreText(text: string, keywords: string[]): number {
    if (!keywords.length) return 0;
    const haystack = text.toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      if (!keyword) continue;
      if (haystack.includes(keyword)) score += 2;
      if (haystack.includes(`${keyword}:`)) score += 1;
      if (haystack.includes(` ${keyword} `)) score += 1;
    }
    return score;
  }

  private cacheKey(classroomId: string, question: string): string {
    return `${classroomId}::${question}`;
  }

  private readCache(
    classroomId: string,
    normalizedQuestion: string,
  ): CachedAnswer | null {
    const key = this.cacheKey(classroomId, normalizedQuestion);
    const item = this.responseCache.get(key);
    if (!item) return null;
    if (item.expiresAt <= Date.now()) {
      this.responseCache.delete(key);
      return null;
    }
    return item;
  }

  private writeCache(
    classroomId: string,
    normalizedQuestion: string,
    value: Omit<CachedAnswer, 'expiresAt'>,
  ) {
    if (!normalizedQuestion) return;

    const now = Date.now();
    const key = this.cacheKey(classroomId, normalizedQuestion);
    this.responseCache.set(key, {
      ...value,
      expiresAt: now + this.cacheTtlMs,
    });

    if (this.responseCache.size <= this.maxCacheEntries) return;

    for (const [cacheKey, cacheValue] of this.responseCache.entries()) {
      if (cacheValue.expiresAt <= now) {
        this.responseCache.delete(cacheKey);
      }
    }

    while (this.responseCache.size > this.maxCacheEntries) {
      const firstKey = this.responseCache.keys().next().value as
        | string
        | undefined;
      if (!firstKey) break;
      this.responseCache.delete(firstKey);
    }
  }
}
