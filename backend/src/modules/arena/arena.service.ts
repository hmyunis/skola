import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from './entities/quiz.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { QuizReport, QuizReportStatus } from './entities/quiz-report.entity';
import { ArenaQuizQueryDto } from './dto/arena-quiz-query.dto';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { AttemptQuizDto } from './dto/attempt-quiz.dto';
import { ArenaLeaderboardQueryDto } from './dto/arena-leaderboard-query.dto';
import { ReportQuizDto } from './dto/report-quiz.dto';
import { ReviewQuizReportDto } from './dto/review-quiz-report.dto';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { UserRole } from '../users/entities/user.entity';
import { Course } from '../academics/entities/course.entity';
import { ClassroomsService } from '../classrooms/classrooms.service';

type ArenaTitle = 'Rookie' | 'Scholar' | 'Strategist' | 'Champion' | 'Legend';
const DELETED_USER_NAME = 'Deleted User';

@Injectable()
export class ArenaService {
  private readonly difficultyXp: Record<'easy' | 'medium' | 'hard', number> = {
    easy: 10,
    medium: 20,
    hard: 30,
  };

  constructor(
    @InjectRepository(Quiz) private quizRepo: Repository<Quiz>,
    @InjectRepository(QuizAttempt) private attemptRepo: Repository<QuizAttempt>,
    @InjectRepository(QuizQuestion)
    private questionRepo: Repository<QuizQuestion>,
    @InjectRepository(QuizReport) private reportRepo: Repository<QuizReport>,
    @InjectRepository(ClassroomMember)
    private memberRepo: Repository<ClassroomMember>,
    @InjectRepository(Course) private courseRepo: Repository<Course>,
    private classroomService: ClassroomsService,
  ) {}

  async getQuizzes(
    classroomId: string,
    userId: string,
    query: ArenaQuizQueryDto,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const search = query.search?.trim();
    const course = query.course?.trim();

    const qb = this.quizRepo
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.author', 'author')
      .loadRelationCountAndMap('quiz.questionCount', 'quiz.questions')
      .where('quiz.classroomId = :classroomId', { classroomId })
      .andWhere('quiz.isPublished = :isPublished', { isPublished: true });

    if (search) {
      qb.andWhere(
        '(quiz.title LIKE :search OR author.name LIKE :search OR author.anonymousId LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (course) {
      qb.andWhere('quiz.courseCode = :course', { course });
    }

    qb.orderBy('quiz.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [quizzes, total] = await qb.getManyAndCount();
    const attemptsUsedMap = await this.getAttemptCountMap(
      quizzes.map((quiz) => quiz.id),
      userId,
    );

    return {
      data: quizzes.map((quiz) => {
        const maxAttempts = this.resolveMaxAttempts(quiz.maxAttempts);
        const attemptsUsed = attemptsUsedMap.get(quiz.id) || 0;
        const attemptsRemaining = Math.max(maxAttempts - attemptsUsed, 0);

        return {
          id: quiz.id,
          title: quiz.title,
          course: quiz.courseCode,
          createdAt: quiz.createdAt,
          anonymous_id: this.getAuthorDisplayName(quiz),
          createdByUser: quiz.authorId === userId,
          questionCount: Number((quiz as any).questionCount || 0),
          maxAttempts,
          attemptsUsed,
          attemptsRemaining,
          canAttempt: attemptsRemaining > 0,
        };
      }),
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getQuiz(quizId: string, classroomId: string, userId: string) {
    const quiz = await this.quizRepo
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.questions', 'question')
      .leftJoinAndSelect('quiz.author', 'author')
      .where('quiz.id = :quizId', { quizId })
      .andWhere('quiz.classroomId = :classroomId', { classroomId })
      .andWhere('quiz.isPublished = :isPublished', { isPublished: true })
      .orderBy('question.orderIndex', 'ASC')
      .getOne();

    if (!quiz) throw new NotFoundException('Quiz not found');

    const attemptsUsed = await this.attemptRepo.count({
      where: { quizId: quiz.id, userId },
    });
    const maxAttempts = this.resolveMaxAttempts(quiz.maxAttempts);
    const attemptsRemaining = Math.max(maxAttempts - attemptsUsed, 0);

    return {
      id: quiz.id,
      title: quiz.title,
      course: quiz.courseCode,
      createdAt: quiz.createdAt,
      anonymous_id: this.getAuthorDisplayName(quiz),
      createdByUser: quiz.authorId === userId,
      questionCount: quiz.questions.length,
      maxAttempts,
      attemptsUsed,
      attemptsRemaining,
      canAttempt: attemptsRemaining > 0,
      questions: quiz.questions.map((question) =>
        this.toQuestionResponse(question, quiz.courseCode),
      ),
    };
  }

  async createQuiz(classroomId: string, authorId: string, data: CreateQuizDto) {
    const title = data.title?.trim();
    const courseCode = data.course?.trim().toUpperCase();
    const maxAttempts = this.resolveMaxAttempts(data.maxAttempts);

    if (!title) throw new BadRequestException('Quiz title is required');
    if (!courseCode) throw new BadRequestException('Course is required');
    if (!data.questions?.length)
      throw new BadRequestException('At least one question is required');

    if (data.isAnonymous) {
      const classroom =
        await this.classroomService.getClassroomById(classroomId);
      const feature = (classroom.featureToggles as any[])?.find(
        (f) => f.id === 'ft-anon-posting',
      );
      if (feature && !feature.enabled) {
        throw new BadRequestException(
          'Anonymous posting is disabled in this classroom',
        );
      }
    }

    const course = await this.courseRepo
      .createQueryBuilder('course')
      .where('course.classroomId = :classroomId', { classroomId })
      .andWhere('UPPER(course.code) = :courseCode', { courseCode })
      .getOne();

    const questions = data.questions.map((question, index) => {
      const questionText = question.questionText?.trim();
      const options = question.options.map((option) => option.trim());
      const correctOptionIndex = question.correctOptionIndex;

      if (!questionText) {
        throw new BadRequestException(`Question ${index + 1} text is required`);
      }
      if (options.some((option) => !option)) {
        throw new BadRequestException(
          `Question ${index + 1} has empty options`,
        );
      }
      if (correctOptionIndex < 0 || correctOptionIndex >= options.length) {
        throw new BadRequestException(
          `Question ${index + 1} has an invalid correct option`,
        );
      }

      return this.questionRepo.create({
        questionText,
        options,
        correctOptionIndex,
        difficulty: question.difficulty,
        durationSeconds: question.durationSeconds || 15,
        orderIndex: index,
      });
    });

    const quiz = this.quizRepo.create({
      classroomId,
      authorId,
      title,
      courseCode,
      courseId: course?.id || null,
      isAnonymous: data.isAnonymous ?? false,
      maxAttempts,
      timeLimitMinutes: 0,
      isPublished: true,
      questions,
    });

    const saved = await this.quizRepo.save(quiz);
    return this.getQuiz(saved.id, classroomId, authorId);
  }

  async deleteQuiz(quizId: string, classroomId: string, userId: string) {
    const quiz = await this.quizRepo.findOne({
      where: { id: quizId, classroomId },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const role = await this.getClassroomRole(classroomId, userId);
    const canDelete =
      quiz.authorId === userId ||
      role === UserRole.ADMIN ||
      role === UserRole.OWNER;

    if (!canDelete) {
      throw new ForbiddenException('You can only delete your own quizzes');
    }

    await this.quizRepo.remove(quiz);
    return { success: true };
  }

  async submitAttempt(
    quizId: string,
    classroomId: string,
    userId: string,
    data: AttemptQuizDto,
  ) {
    const quiz = await this.quizRepo
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.questions', 'question')
      .where('quiz.id = :quizId', { quizId })
      .andWhere('quiz.classroomId = :classroomId', { classroomId })
      .andWhere('quiz.isPublished = :isPublished', { isPublished: true })
      .orderBy('question.orderIndex', 'ASC')
      .getOne();

    if (!quiz) throw new NotFoundException('Quiz not found');

    const maxAttempts = this.resolveMaxAttempts(quiz.maxAttempts);
    const attemptsUsed = await this.attemptRepo.count({
      where: { quizId, userId },
    });
    if (attemptsUsed >= maxAttempts) {
      throw new BadRequestException(
        `Attempt limit reached (${maxAttempts} max attempts for this quiz).`,
      );
    }

    const answers = data.answers || [];
    if (answers.length !== quiz.questions.length) {
      throw new BadRequestException('You must answer all questions');
    }

    let correctAnswers = 0;
    let score = 0;

    quiz.questions.forEach((question, index) => {
      const selected = answers[index];
      if (selected === question.correctOptionIndex) {
        correctAnswers += 1;
        score +=
          this.difficultyXp[question.difficulty] || this.difficultyXp.medium;
      }
    });

    const totalQuestions = quiz.questions.length;
    const won = correctAnswers >= Math.ceil(totalQuestions / 2);

    const attempt = this.attemptRepo.create({
      quizId,
      userId,
      score,
      totalQuestions,
      correctAnswers,
      won,
    });
    const savedAttempt = await this.attemptRepo.save(attempt);
    const stats = await this.getUserStats(classroomId, userId);
    const nextAttemptsUsed = attemptsUsed + 1;
    const attemptsRemaining = Math.max(maxAttempts - nextAttemptsUsed, 0);

    return {
      id: savedAttempt.id,
      score,
      totalQuestions,
      correctAnswers,
      won,
      xpEarned: score,
      maxAttempts,
      attemptsUsed: nextAttemptsUsed,
      attemptsRemaining,
      stats,
    };
  }

  async getUserStats(classroomId: string, userId: string) {
    const attempts = await this.attemptRepo
      .createQueryBuilder('attempt')
      .innerJoin('attempt.quiz', 'quiz')
      .where('attempt.userId = :userId', { userId })
      .andWhere('quiz.classroomId = :classroomId', { classroomId })
      .orderBy('attempt.completedAt', 'ASC')
      .getMany();

    const xp = attempts.reduce((sum, item) => sum + Number(item.score || 0), 0);
    const wins = attempts.reduce((sum, item) => sum + (item.won ? 1 : 0), 0);
    const totalPlayed = attempts.length;
    const correctAnswers = attempts.reduce(
      (sum, item) => sum + Number(item.correctAnswers || 0),
      0,
    );
    const totalAnswers = attempts.reduce(
      (sum, item) => sum + Number(item.totalQuestions || 0),
      0,
    );

    let bestStreak = 0;
    let runningStreak = 0;
    for (const attempt of attempts) {
      if (attempt.won) {
        runningStreak += 1;
        if (runningStreak > bestStreak) bestStreak = runningStreak;
      } else {
        runningStreak = 0;
      }
    }

    let streak = 0;
    for (let i = attempts.length - 1; i >= 0; i -= 1) {
      if (!attempts[i].won) break;
      streak += 1;
    }

    return {
      xp,
      wins,
      totalPlayed,
      streak,
      bestStreak,
      correctAnswers,
      totalAnswers,
      accuracy:
        totalAnswers > 0
          ? Math.round((correctAnswers / totalAnswers) * 100)
          : 0,
      title: this.getArenaTitle(xp),
    };
  }

  async getLeaderboard(classroomId: string, query: ArenaLeaderboardQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const search = query.search?.trim();

    const aggregateQb = this.attemptRepo
      .createQueryBuilder('attempt')
      .innerJoin('attempt.quiz', 'quiz')
      .innerJoin('attempt.user', 'user')
      .where('quiz.classroomId = :classroomId', { classroomId });

    if (search) {
      aggregateQb.andWhere(
        '(user.name LIKE :search OR user.anonymousId LIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    const countResult = await aggregateQb
      .clone()
      .select('COUNT(DISTINCT user.id)', 'total')
      .getRawOne();

    const rows = await aggregateQb
      .select([
        'user.id AS userId',
        `CASE
          WHEN user.deletedAt IS NOT NULL THEN '${DELETED_USER_NAME}'
          ELSE COALESCE(user.anonymousId, CONCAT("Anon#", UPPER(SUBSTRING(MD5(user.id), 1, 4))))
        END AS anonymousId`,
        'SUM(attempt.score) AS xp',
        'SUM(CASE WHEN attempt.won = 1 THEN 1 ELSE 0 END) AS wins',
        'SUM(attempt.correctAnswers) AS correctAnswers',
        'SUM(attempt.totalQuestions) AS totalAnswers',
      ])
      .groupBy('user.id')
      .orderBy('xp', 'DESC')
      .addOrderBy('wins', 'DESC')
      .addOrderBy('correctAnswers', 'DESC')
      .addOrderBy('user.id', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    const userIds = rows.map((row) => row.userId).filter(Boolean);
    const streakMap = await this.getCurrentStreakMap(classroomId, userIds);

    const data = rows.map((row: any, index: number) => {
      const xp = Number(row.xp || 0);
      const wins = Number(row.wins || 0);
      const totalAnswers = Number(row.totalAnswers || 0);
      const correctAnswers = Number(row.correctAnswers || 0);
      const accuracy =
        totalAnswers > 0
          ? Math.round((correctAnswers / totalAnswers) * 100)
          : 0;

      return {
        rank: (page - 1) * limit + index + 1,
        anonymous_id: row.anonymousId,
        xp,
        wins,
        streak: streakMap.get(row.userId) || 0,
        accuracy,
        title: this.getArenaTitle(xp),
      };
    });

    const total = Number(countResult?.total || 0);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit) || 1,
      },
    };
  }

  async reportQuiz(
    quizId: string,
    classroomId: string,
    reporterId: string,
    data: ReportQuizDto,
  ) {
    const quiz = await this.quizRepo.findOne({
      where: { id: quizId, classroomId, isPublished: true },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.authorId === reporterId) {
      throw new BadRequestException('You cannot report your own quiz');
    }

    const reason = (data.reason || '').trim();
    if (!reason) throw new BadRequestException('Reason is required');

    const existing = await this.reportRepo.findOne({
      where: {
        quizId,
        classroomId,
        reporterId,
        status: QuizReportStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You already submitted a pending report for this quiz',
      );
    }

    const report = this.reportRepo.create({
      quizId,
      classroomId,
      reporterId,
      reason,
      details: data.details?.trim() || undefined,
    });
    return this.reportRepo.save(report);
  }

  async listReports(classroomId: string, status?: QuizReportStatus) {
    const where: any = { classroomId };
    if (status) where.status = status;

    const reports = await this.reportRepo.find({
      where,
      relations: ['quiz', 'quiz.author', 'reporter', 'reviewedBy'],
      order: { createdAt: 'DESC' },
    });

    return reports.map((report) => ({
      id: report.id,
      type: 'quiz',
      contentId: report.quizId,
      content: report.quiz?.title || 'Deleted quiz',
      author: report.quiz ? this.getAuthorDisplayName(report.quiz) : 'Unknown',
      reason: report.reason,
      details: report.details,
      reportedBy: report.reporter?.name || 'Unknown',
      reportedAt: report.createdAt,
      status: report.status,
      reviewedAt: report.reviewedAt,
      reviewedBy: report.reviewedBy?.name,
    }));
  }

  async reviewReport(
    reportId: string,
    classroomId: string,
    reviewerId: string,
    data: ReviewQuizReportDto,
  ) {
    const report = await this.reportRepo.findOne({
      where: { id: reportId, classroomId },
      relations: ['quiz'],
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== QuizReportStatus.PENDING) {
      throw new BadRequestException('This report was already reviewed');
    }

    report.status =
      data.status === 'resolved'
        ? QuizReportStatus.RESOLVED
        : QuizReportStatus.DISMISSED;
    report.reviewedById = reviewerId;
    report.reviewedAt = new Date();
    await this.reportRepo.save(report);

    if (data.status === 'resolved' && data.removeQuiz && report.quiz) {
      await this.quizRepo.remove(report.quiz);
      await this.reportRepo.update(
        {
          classroomId,
          quizId: report.quizId,
          status: QuizReportStatus.PENDING,
        },
        {
          status: QuizReportStatus.RESOLVED,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      );
    }

    return { success: true };
  }

  private toQuestionResponse(question: QuizQuestion, courseCode: string) {
    return {
      id: question.id,
      question: question.questionText,
      options: question.options,
      correctIndex: question.correctOptionIndex,
      course: courseCode,
      difficulty: question.difficulty,
      durationSeconds: question.durationSeconds || 15,
    };
  }

  private getAuthorDisplayName(
    quiz: Partial<Quiz> & {
      author?: {
        name?: string | null;
        anonymousId?: string | null;
        deletedAt?: Date | null;
      };
    },
  ) {
    if (quiz.author?.deletedAt) {
      return DELETED_USER_NAME;
    }
    if (quiz.isAnonymous) {
      return quiz.author?.anonymousId || 'Anonymous';
    }
    return quiz.author?.name || DELETED_USER_NAME;
  }

  private getArenaTitle(xp: number): ArenaTitle {
    if (xp >= 2000) return 'Legend';
    if (xp >= 1000) return 'Champion';
    if (xp >= 500) return 'Strategist';
    if (xp >= 200) return 'Scholar';
    return 'Rookie';
  }

  private async getClassroomRole(
    classroomId: string,
    userId: string,
  ): Promise<UserRole | null> {
    const member = await this.memberRepo.findOne({
      where: {
        classroom: { id: classroomId },
        user: { id: userId },
      },
    });
    return member?.role || null;
  }

  private resolveMaxAttempts(maxAttempts?: number | null): number {
    const parsed = Number(maxAttempts);
    if (!Number.isFinite(parsed)) return 2;
    const normalized = Math.floor(parsed);
    return normalized >= 1 ? normalized : 2;
  }

  private async getAttemptCountMap(
    quizIds: string[],
    userId: string,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!quizIds.length) return map;

    const rows = await this.attemptRepo
      .createQueryBuilder('attempt')
      .select('attempt.quizId', 'quizId')
      .addSelect('COUNT(attempt.id)', 'total')
      .where('attempt.userId = :userId', { userId })
      .andWhere('attempt.quizId IN (:...quizIds)', { quizIds })
      .groupBy('attempt.quizId')
      .getRawMany<{ quizId: string; total: string }>();

    for (const row of rows) {
      map.set(row.quizId, Number(row.total || 0));
    }

    return map;
  }

  private async getCurrentStreakMap(classroomId: string, userIds: string[]) {
    const streakMap = new Map<string, number>();
    if (!userIds.length) return streakMap;

    const attempts = await this.attemptRepo
      .createQueryBuilder('attempt')
      .innerJoin('attempt.quiz', 'quiz')
      .where('attempt.userId IN (:...userIds)', { userIds })
      .andWhere('quiz.classroomId = :classroomId', { classroomId })
      .orderBy('attempt.completedAt', 'DESC')
      .getMany();

    const attemptsByUser = new Map<string, QuizAttempt[]>();
    for (const attempt of attempts) {
      const group = attemptsByUser.get(attempt.userId) || [];
      group.push(attempt);
      attemptsByUser.set(attempt.userId, group);
    }

    for (const userId of userIds) {
      const userAttempts = attemptsByUser.get(userId) || [];
      let streak = 0;
      for (const attempt of userAttempts) {
        if (!attempt.won) break;
        streak += 1;
      }
      streakMap.set(userId, streak);
    }

    return streakMap;
  }
}
