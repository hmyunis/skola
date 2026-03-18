import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Announcement, AnnouncementTargetAudience, PriorityLevel } from './entities/announcement.entity';
import { InviteCode } from './entities/invite-code.entity';
import { Classroom } from '../classrooms/entities/classroom.entity';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { UserRole } from '../users/entities/user.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { LoungePost } from '../lounge/entities/lounge-post.entity';
import { Resource } from '../resources/entities/resource.entity';
import { Quiz } from '../arena/entities/quiz.entity';
import { QuizAttempt } from '../arena/entities/quiz-attempt.entity';
import { Course } from '../academics/entities/course.entity';
import { ResourceReport, ResourceReportStatus } from '../resources/entities/resource-report.entity';
import {
  LoungeReport,
  LoungeReportContentType,
  LoungeReportStatus,
} from '../lounge/entities/lounge-report.entity';
import { QuizReport, QuizReportStatus } from '../arena/entities/quiz-report.entity';
import { ModerationQueryDto } from './dto/moderation-query.dto';

interface UpsertAnnouncementDto {
  title: string;
  content: string;
  priority?: PriorityLevel;
  targetAudience?: AnnouncementTargetAudience;
  pinned?: boolean;
  expiresAt?: string | Date;
  sendTelegram?: boolean;
}

export interface OwnerAnalyticsResponse {
  totalUsers: number;
  activeToday: number;
  totalPosts: number;
  totalResources: number;
  totalQuizzes: number;
  avgDailyActive: number;
  engagementRate: number;
  topCourses: { code: string; name: string; engagement: number }[];
  weeklyActivity: { day: string; posts: number; resources: number; quizzes: number }[];
  userGrowth: { month: string; users: number }[];
}

export type OwnerExportDatasetId = 'users' | 'posts' | 'resources' | 'quizzes' | 'analytics';

export interface OwnerExportDatasetSummary {
  id: OwnerExportDatasetId;
  label: string;
  description: string;
  recordCount: number;
  estimatedSizeBytes: number;
}

export interface OwnerExportResponse {
  fileName: string;
  generatedAt: string;
  classroom: { id: string; name: string };
  datasetIds: OwnerExportDatasetId[];
  datasets: Partial<Record<OwnerExportDatasetId, unknown>>;
}

interface ActivityEventRow {
  userId: string;
  dayKey: string;
}

interface DailyCountRow {
  dateKey: string;
  total: string;
}

type ModerationStatus = 'pending' | 'resolved' | 'dismissed';
type ModerationType = 'resource' | 'post' | 'reply' | 'quiz';

export interface ModerationItem {
  id: string;
  type: ModerationType;
  content: string;
  author: string;
  reason: string;
  reportedBy: string;
  reportedAt: Date;
  status: ModerationStatus;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private static readonly SURPRISE_ASSESSMENT_TITLE = 'Surprise Assessment Alarm';
  private static readonly DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
  private static readonly TOP_COURSE_RESOURCE_WEIGHT = 2;
  private static readonly TOP_COURSE_QUIZ_WEIGHT = 3;
  private static readonly TOP_COURSE_ATTEMPT_WEIGHT = 1;
  private static readonly TOP_COURSE_LOUNGE_WEIGHT = 1;
  private static readonly EXPORT_LOG_WINDOW_DAYS = 30;
  private static readonly EXPORT_DATASET_DETAILS: Record<
    OwnerExportDatasetId,
    { label: string; description: string }
  > = {
    users: {
      label: 'Users & Profiles',
      description: 'All classroom members, role assignments, and account metadata.',
    },
    posts: {
      label: 'Lounge Posts & Replies',
      description: 'All lounge posts, replies, tags, and reactions.',
    },
    resources: {
      label: 'Resource Metadata',
      description: 'All resource entries and metadata (without raw uploaded files).',
    },
    quizzes: {
      label: 'Quiz Data',
      description: 'All quizzes, question sets, attempts, and leaderboard snapshots.',
    },
    analytics: {
      label: 'Analytics Logs',
      description: 'Analytics summaries and day-by-day activity metrics.',
    },
  };

  constructor(
    @InjectRepository(Announcement) private announcementRepo: Repository<Announcement>,
    @InjectRepository(InviteCode) private inviteCodeRepo: Repository<InviteCode>,
    @InjectRepository(Classroom) private classroomRepo: Repository<Classroom>,
    @InjectRepository(ClassroomMember) private memberRepo: Repository<ClassroomMember>,
    @InjectRepository(LoungePost) private postRepo: Repository<LoungePost>,
    @InjectRepository(Resource) private resourceRepo: Repository<Resource>,
    @InjectRepository(ResourceReport) private resourceReportRepo: Repository<ResourceReport>,
    @InjectRepository(LoungeReport) private loungeReportRepo: Repository<LoungeReport>,
    @InjectRepository(Quiz) private quizRepo: Repository<Quiz>,
    @InjectRepository(QuizReport) private quizReportRepo: Repository<QuizReport>,
    @InjectRepository(QuizAttempt) private attemptRepo: Repository<QuizAttempt>,
    @InjectRepository(Course) private courseRepo: Repository<Course>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private toAudienceFilter(role: UserRole): AnnouncementTargetAudience[] {
    if (role === UserRole.STUDENT) {
      return [AnnouncementTargetAudience.ALL, AnnouncementTargetAudience.STUDENTS];
    }

    return [
      AnnouncementTargetAudience.ALL,
      AnnouncementTargetAudience.STUDENTS,
      AnnouncementTargetAudience.ADMINS,
    ];
  }

  private toAnnouncementResponse(announcement: Announcement) {
    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
      expiresAt: announcement.expiresAt,
      createdBy: announcement.author?.name || 'System',
      targetAudience: announcement.targetAudience,
      pinned: announcement.pinned,
    };
  }

  async getAnnouncements(classroomId: string, userId: string) {
    const member = await this.memberRepo.findOne({
      where: { classroom: { id: classroomId }, user: { id: userId } },
    });

    if (!member) {
      throw new BadRequestException('You are not a member of this classroom');
    }

    const announcements = await this.announcementRepo.find({
      where: {
        classroomId,
        targetAudience: In(this.toAudienceFilter(member.role)),
      },
      relations: ['author'],
      order: {
        pinned: 'DESC',
        createdAt: 'DESC',
      },
    });

    return announcements.map((a) => this.toAnnouncementResponse(a));
  }

  async createAnnouncement(classroomId: string, authorId: string, data: UpsertAnnouncementDto) {
    const parsedExpiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    const expiresAt = parsedExpiresAt && !Number.isNaN(parsedExpiresAt.getTime()) ? parsedExpiresAt : null;

    const announcement = this.announcementRepo.create({
      classroomId,
      authorId,
      title: data.title,
      content: data.content,
      priority: data.priority || PriorityLevel.NORMAL,
      targetAudience: data.targetAudience || AnnouncementTargetAudience.ALL,
      pinned: Boolean(data.pinned),
      expiresAt,
    });

    const saved = await this.announcementRepo.save(announcement);
    const withAuthor = await this.announcementRepo.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });

    if (!withAuthor) {
      throw new NotFoundException('Announcement not found');
    }

    if (data.sendTelegram) {
      await this.sendAnnouncementToTelegram(classroomId, withAuthor);
    }

    return this.toAnnouncementResponse(withAuthor);
  }

  async triggerSurpriseAssessment(classroomId: string, authorId: string) {
    const classroom = await this.classroomRepo.findOne({ where: { id: classroomId } });
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    const panicFeature = (classroom.featureToggles as any[] | undefined)?.find(
      (feature) => feature?.id === 'ft-panic',
    );
    const panicEnabled = panicFeature ? Boolean(panicFeature.enabled) : true;

    if (!panicEnabled) {
      throw new BadRequestException('Surprise Assessment feature is disabled for this classroom.');
    }

    const announcement = this.announcementRepo.create({
      classroomId,
      authorId,
      title: AdminService.SURPRISE_ASSESSMENT_TITLE,
      content: 'A surprise assessment has been triggered. Check with your instructor immediately.',
      priority: PriorityLevel.URGENT,
      targetAudience: AnnouncementTargetAudience.ALL,
      pinned: true,
      expiresAt: null,
    });

    const saved = await this.announcementRepo.save(announcement);
    const withAuthor = await this.announcementRepo.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });

    if (!withAuthor) {
      throw new NotFoundException('Announcement not found');
    }

    return this.toAnnouncementResponse(withAuthor);
  }

  async stopSurpriseAssessment(classroomId: string) {
    const now = new Date();

    const activeAlarms = await this.announcementRepo
      .createQueryBuilder('announcement')
      .where('announcement.classroomId = :classroomId', { classroomId })
      .andWhere('announcement.title = :title', { title: AdminService.SURPRISE_ASSESSMENT_TITLE })
      .andWhere('(announcement.expiresAt IS NULL OR announcement.expiresAt > :now)', { now })
      .getMany();

    if (!activeAlarms.length) {
      return { success: true, stopped: 0 };
    }

    for (const alarm of activeAlarms) {
      alarm.pinned = false;
      alarm.expiresAt = now;
    }

    await this.announcementRepo.save(activeAlarms);
    return { success: true, stopped: activeAlarms.length };
  }

  private async sendAnnouncementToTelegram(classroomId: string, announcement: Announcement): Promise<void> {
    const classroom = await this.classroomRepo.findOne({ where: { id: classroomId } });
    if (!classroom?.telegramGroupId) {
      throw new BadRequestException('No Telegram group is configured for this classroom.');
    }

    let botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new BadRequestException('Telegram bot token is not configured.');
    }
    botToken = botToken.trim().replace(/^["']|["']$/g, '');

    const icon =
      announcement.priority === PriorityLevel.URGENT ? '🚨'
      : announcement.priority === PriorityLevel.HIGH ? '⚠️'
      : announcement.priority === PriorityLevel.NORMAL ? '📢'
      : 'ℹ️';

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const lines = [
      `${icon} <b>New Announcement</b>`,
      '',
      `<b>${escapeHtml(announcement.title)}</b>`,
      escapeHtml(announcement.content),
      '',
      `<i>Priority: ${announcement.priority.toUpperCase()}</i>`,
    ];

    if (announcement.expiresAt) {
      const expiresLocal = new Date(announcement.expiresAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
      lines.push(`<i>Expires: ${expiresLocal}</i>`);
    }

    const text = lines.join('\n');
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
      await firstValueFrom(this.httpService.post(url, {
        chat_id: classroom.telegramGroupId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }));
    } catch (error: any) {
      this.logger.error(
        `Failed to send Telegram announcement for classroom ${classroomId}`,
        error?.response?.data || error?.message,
      );
      throw new BadRequestException('Failed to send announcement to Telegram. Ensure bot is in the group with posting permissions.');
    }
  }

  async updateAnnouncement(classroomId: string, announcementId: string, data: UpsertAnnouncementDto) {
    const announcement = await this.announcementRepo.findOne({
      where: { id: announcementId, classroomId },
      relations: ['author'],
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    const parsedExpiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    const expiresAt = parsedExpiresAt && !Number.isNaN(parsedExpiresAt.getTime()) ? parsedExpiresAt : null;

    announcement.title = data.title;
    announcement.content = data.content;
    announcement.priority = data.priority || PriorityLevel.NORMAL;
    announcement.targetAudience = data.targetAudience || AnnouncementTargetAudience.ALL;
    announcement.pinned = Boolean(data.pinned);
    announcement.expiresAt = expiresAt;

    const updated = await this.announcementRepo.save(announcement);
    const withAuthor = await this.announcementRepo.findOne({
      where: { id: updated.id },
      relations: ['author'],
    });

    if (!withAuthor) {
      throw new NotFoundException('Announcement not found');
    }

    return this.toAnnouncementResponse(withAuthor);
  }

  async deleteAnnouncement(classroomId: string, announcementId: string) {
    const announcement = await this.announcementRepo.findOne({
      where: { id: announcementId, classroomId },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    await this.announcementRepo.remove(announcement);
    return { success: true };
  }

  async generateInviteCode(classroomId: string, createdBy: string, data: { maxUses?: number; expiresAt?: Date }) {
    // Generate a unique code
    const code = this.generateRandomCode();
    
    const inviteCode = this.inviteCodeRepo.create({
      code,
      classroomId,
      creator: { id: createdBy } as any,
      maxUses: data.maxUses,
      expiresAt: data.expiresAt,
    });

    return this.inviteCodeRepo.save(inviteCode);
  }

  async validateInviteCode(code: string) {
    // 1. Try dynamic invite code
    const invite = await this.inviteCodeRepo.findOne({
      where: { code, isActive: true },
      relations: ['classroom'],
    });

    if (invite) {
      if (invite.expiresAt && new Date() > invite.expiresAt) {
        invite.isActive = false;
        await this.inviteCodeRepo.save(invite);
        throw new BadRequestException('Invite code has expired');
      }

      if (invite.maxUses && invite.uses >= invite.maxUses) {
        invite.isActive = false;
        await this.inviteCodeRepo.save(invite);
        throw new BadRequestException('Invite code has reached its maximum uses');
      }

      return {
        valid: true,
        classroom: {
          id: invite.classroom.id,
          name: invite.classroom.name,
        },
      };
    }

    // 2. Try default classroom code
    const classroom = await this.classroomRepo.findOne({
      where: { inviteCode: code, isActive: true },
    });

    if (classroom) {
      return {
        valid: true,
        classroom: {
          id: classroom.id,
          name: classroom.name,
        },
      };
    }

    throw new BadRequestException('Invalid or inactive invite code');
  }

  async getModerationReports(classroomId: string, query: ModerationQueryDto): Promise<ModerationItem[]> {
    const status = query.status;
    const type = query.type;

    const shouldFetchResource = !type || type === 'resource';
    const shouldFetchLounge = !type || type === 'post' || type === 'reply';
    const shouldFetchQuiz = !type || type === 'quiz';

    const resourceWhere: Partial<ResourceReport> = { classroomId };
    if (status) {
      resourceWhere.status = status as ResourceReportStatus;
    }

    const loungeWhere: Partial<LoungeReport> = { classroomId };
    if (status) {
      loungeWhere.status = status as LoungeReportStatus;
    }
    if (type === 'post') {
      loungeWhere.contentType = LoungeReportContentType.POST;
    } else if (type === 'reply') {
      loungeWhere.contentType = LoungeReportContentType.REPLY;
    }

    const quizWhere: Partial<QuizReport> = { classroomId };
    if (status) {
      quizWhere.status = status as QuizReportStatus;
    }

    const [resourceReports, loungeReports, quizReports] = await Promise.all([
      shouldFetchResource
        ? this.resourceReportRepo.find({
            where: resourceWhere,
            relations: ['resource', 'resource.uploader', 'reporter'],
            order: { createdAt: 'DESC' },
          })
        : Promise.resolve([]),
      shouldFetchLounge
        ? this.loungeReportRepo.find({
            where: loungeWhere,
            relations: ['post', 'post.author', 'reporter'],
            order: { createdAt: 'DESC' },
          })
        : Promise.resolve([]),
      shouldFetchQuiz
        ? this.quizReportRepo.find({
            where: quizWhere,
            relations: ['quiz', 'quiz.author', 'reporter'],
            order: { createdAt: 'DESC' },
          })
        : Promise.resolve([]),
    ]);

    const resourceItems: ModerationItem[] = resourceReports.map((report) => ({
      id: report.id,
      type: 'resource',
      content: report.resource?.title || 'Deleted resource',
      author: report.resource?.uploader?.name || 'Unknown',
      reason: report.reason,
      reportedBy: report.reporter?.name || 'Unknown',
      reportedAt: report.createdAt,
      status: report.status as ModerationStatus,
    }));

    const loungeItems: ModerationItem[] = loungeReports.map((report) => ({
      id: report.id,
      type:
        report.contentType === LoungeReportContentType.REPLY ? 'reply' : 'post',
      content: report.post?.content || 'Deleted content',
      author: report.post?.author?.name || 'Unknown',
      reason: report.reason,
      reportedBy: report.reporter?.name || 'Unknown',
      reportedAt: report.createdAt,
      status: report.status as ModerationStatus,
    }));

    const quizItems: ModerationItem[] = quizReports.map((report) => ({
      id: report.id,
      type: 'quiz',
      content: report.quiz?.title || 'Deleted quiz',
      author: report.quiz?.author?.name || 'Unknown',
      reason: report.reason,
      reportedBy: report.reporter?.name || 'Unknown',
      reportedAt: report.createdAt,
      status: report.status as ModerationStatus,
    }));

    return [...resourceItems, ...loungeItems, ...quizItems].sort(
      (a, b) => b.reportedAt.getTime() - a.reportedAt.getTime(),
    );
  }

  async getModerationStats(classroomId: string, query: ModerationQueryDto) {
    const statusFilter = query.status;
    const typeFilter = query.type;

    if (statusFilter) {
      const total = await this.countModerationByStatus(classroomId, statusFilter, typeFilter);
      return {
        total,
        pending: statusFilter === 'pending' ? total : 0,
        resolved: statusFilter === 'resolved' ? total : 0,
        dismissed: statusFilter === 'dismissed' ? total : 0,
      };
    }

    const [pending, resolved, dismissed] = await Promise.all([
      this.countModerationByStatus(classroomId, 'pending', typeFilter),
      this.countModerationByStatus(classroomId, 'resolved', typeFilter),
      this.countModerationByStatus(classroomId, 'dismissed', typeFilter),
    ]);

    return {
      total: pending + resolved + dismissed,
      pending,
      resolved,
      dismissed,
    };
  }

  private async countModerationByStatus(
    classroomId: string,
    status: ModerationStatus,
    type?: ModerationType,
  ): Promise<number> {
    if (type === 'resource') {
      return this.resourceReportRepo.count({
        where: { classroomId, status: status as ResourceReportStatus },
      });
    }

    if (type === 'quiz') {
      return this.quizReportRepo.count({
        where: { classroomId, status: status as QuizReportStatus },
      });
    }

    if (type === 'post' || type === 'reply') {
      return this.loungeReportRepo.count({
        where: {
          classroomId,
          status: status as LoungeReportStatus,
          contentType:
            type === 'reply'
              ? LoungeReportContentType.REPLY
              : LoungeReportContentType.POST,
        },
      });
    }

    const [resourceTotal, loungeTotal, quizTotal] = await Promise.all([
      this.resourceReportRepo.count({
        where: { classroomId, status: status as ResourceReportStatus },
      }),
      this.loungeReportRepo.count({
        where: { classroomId, status: status as LoungeReportStatus },
      }),
      this.quizReportRepo.count({
        where: { classroomId, status: status as QuizReportStatus },
      }),
    ]);

    return resourceTotal + loungeTotal + quizTotal;
  }

  async getOwnerAnalytics(classroomId: string): Promise<OwnerAnalyticsResponse> {
    const now = new Date();
    const todayStartUtc = this.startOfUtcDay(now);
    const tomorrowStartUtc = this.addUtcDays(todayStartUtc, 1);
    const sevenDayWindowStartUtc = this.addUtcDays(todayStartUtc, -6);
    const weekStartUtc = this.startOfUtcWeek(todayStartUtc);
    const weekEndUtc = this.addUtcDays(weekStartUtc, 7);

    const [totalUsers, totalPosts, totalResources, totalQuizzes, dailyActiveUsers, weeklyActivity, topCourses, userGrowth] =
      await Promise.all([
        this.memberRepo
          .createQueryBuilder('member')
          .where('member.classroomId = :classroomId', { classroomId })
          .getCount(),
        this.postRepo
          .createQueryBuilder('post')
          .where('post.classroomId = :classroomId', { classroomId })
          .andWhere('post.parentId IS NULL')
          .getCount(),
        this.resourceRepo
          .createQueryBuilder('resource')
          .where('resource.classroomId = :classroomId', { classroomId })
          .getCount(),
        this.quizRepo
          .createQueryBuilder('quiz')
          .where('quiz.classroomId = :classroomId', { classroomId })
          .getCount(),
        this.getDailyActiveUsersByDate(classroomId, sevenDayWindowStartUtc, tomorrowStartUtc),
        this.getWeeklyActivity(classroomId, weekStartUtc, weekEndUtc),
        this.getTopCourses(classroomId),
        this.getUserGrowth(classroomId, now),
      ]);

    const todayKey = this.toUtcDateKey(todayStartUtc);
    const activeToday = dailyActiveUsers.get(todayKey)?.size || 0;
    const avgDailyActive = Math.round(this.averageDailyActive(dailyActiveUsers, sevenDayWindowStartUtc, 7));
    const sevenDayActiveUsers = this.countDistinctUsers(dailyActiveUsers);
    const engagementRate = totalUsers > 0 ? Math.round((sevenDayActiveUsers / totalUsers) * 100) : 0;

    return {
      totalUsers,
      activeToday,
      totalPosts,
      totalResources,
      totalQuizzes,
      avgDailyActive,
      engagementRate,
      topCourses,
      weeklyActivity,
      userGrowth,
    };
  }

  async getOwnerExportDatasets(classroomId: string): Promise<OwnerExportDatasetSummary[]> {
    const [users, posts, resources, quizzes] = await Promise.all([
      this.memberRepo
        .createQueryBuilder('member')
        .where('member.classroomId = :classroomId', { classroomId })
        .getCount(),
      this.postRepo
        .createQueryBuilder('post')
        .where('post.classroomId = :classroomId', { classroomId })
        .getCount(),
      this.resourceRepo
        .createQueryBuilder('resource')
        .where('resource.classroomId = :classroomId', { classroomId })
        .getCount(),
      this.quizRepo
        .createQueryBuilder('quiz')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .getCount(),
    ]);

    const baseCounts: Record<OwnerExportDatasetId, number> = {
      users,
      posts,
      resources,
      quizzes,
      analytics: AdminService.EXPORT_LOG_WINDOW_DAYS,
    };

    return (Object.keys(AdminService.EXPORT_DATASET_DETAILS) as OwnerExportDatasetId[]).map((id) => ({
      id,
      label: AdminService.EXPORT_DATASET_DETAILS[id].label,
      description: AdminService.EXPORT_DATASET_DETAILS[id].description,
      recordCount: baseCounts[id],
      estimatedSizeBytes: this.estimateDatasetSizeBytes(id, baseCounts[id]),
    }));
  }

  async exportOwnerData(
    classroomId: string,
    requestedDatasetIds: OwnerExportDatasetId[],
  ): Promise<OwnerExportResponse> {
    const datasetIds = this.normalizeExportDatasetIds(requestedDatasetIds);
    if (!datasetIds.length) {
      throw new BadRequestException('Select at least one dataset to export.');
    }

    const classroom = await this.classroomRepo.findOne({
      where: { id: classroomId },
      select: ['id', 'name'],
    });
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    const datasetEntries = await Promise.all(
      datasetIds.map(async (datasetId) => [datasetId, await this.buildExportDataset(classroomId, datasetId)] as const),
    );

    return {
      fileName: `${this.slugify(classroom.name || 'classroom')}-export-${new Date().toISOString().slice(0, 10)}.json`,
      generatedAt: new Date().toISOString(),
      classroom: { id: classroom.id, name: classroom.name },
      datasetIds,
      datasets: Object.fromEntries(datasetEntries),
    };
  }

  async updateFeatureToggles(classroomId: string, toggles: Record<string, boolean>) {
    const classroom = await this.classroomRepo.findOne({ where: { id: classroomId } });
    if (!classroom) {
      throw new BadRequestException('Classroom not found');
    }

    // Initialize featureToggles if it doesn't exist
    classroom.featureToggles = classroom.featureToggles || {
      social: true,
      gamification: true,
      experimental: true,
    };

    // Update the toggles
    Object.assign(classroom.featureToggles, toggles);

    return this.classroomRepo.save(classroom);
  }

  async getInviteCodes(classroomId: string) {
    return this.inviteCodeRepo.find({
      where: { classroomId },
      order: { createdAt: 'DESC' },
    });
  }

  async deactivateInviteCode(id: string) {
    const invite = await this.inviteCodeRepo.findOne({ where: { id } });
    if (!invite) throw new BadRequestException('Invite code not found');
    invite.isActive = false;
    return this.inviteCodeRepo.save(invite);
  }

  async deleteInviteCode(id: string) {
    return this.inviteCodeRepo.delete(id);
  }

  private normalizeExportDatasetIds(requestedDatasetIds: OwnerExportDatasetId[]): OwnerExportDatasetId[] {
    if (!Array.isArray(requestedDatasetIds)) return [];

    const allowed = new Set<OwnerExportDatasetId>([
      'users',
      'posts',
      'resources',
      'quizzes',
      'analytics',
    ]);

    const normalized = Array.from(
      new Set(
        requestedDatasetIds.map((id) =>
          String(id || '').trim().toLowerCase(),
        ),
      ),
    );

    const invalid = normalized.filter((id) => !allowed.has(id as OwnerExportDatasetId));
    if (invalid.length) {
      throw new BadRequestException(`Unknown export dataset(s): ${invalid.join(', ')}`);
    }

    return normalized as OwnerExportDatasetId[];
  }

  private async buildExportDataset(classroomId: string, datasetId: OwnerExportDatasetId) {
    switch (datasetId) {
      case 'users':
        return this.exportUsersDataset(classroomId);
      case 'posts':
        return this.exportPostsDataset(classroomId);
      case 'resources':
        return this.exportResourcesDataset(classroomId);
      case 'quizzes':
        return this.exportQuizzesDataset(classroomId);
      case 'analytics':
        return this.exportAnalyticsDataset(classroomId);
      default:
        throw new BadRequestException(`Unsupported dataset: ${datasetId}`);
    }
  }

  private async exportUsersDataset(classroomId: string) {
    const members = await this.memberRepo
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.user', 'user')
      .where('member.classroomId = :classroomId', { classroomId })
      .orderBy('member.joinedAt', 'ASC')
      .getMany();

    return members.map((member) => ({
      membershipId: member.id,
      joinedAt: member.joinedAt,
      role: member.role,
      user: member.user
        ? {
            id: member.user.id,
            telegramId: member.user.telegramId,
            name: member.user.name,
            telegramUsername: member.user.telegramUsername,
            photoUrl: member.user.photoUrl,
            role: member.user.role,
            year: member.user.year,
            semester: member.user.semester,
            batch: member.user.batch,
            anonymousId: member.user.anonymousId,
            isBanned: member.user.isBanned,
            suspendedUntil: member.user.suspendedUntil,
            createdAt: member.user.createdAt,
            updatedAt: member.user.updatedAt,
          }
        : null,
    }));
  }

  private async exportPostsDataset(classroomId: string) {
    const posts = await this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.classroomId = :classroomId', { classroomId })
      .orderBy('post.createdAt', 'ASC')
      .getMany();

    return posts.map((post) => ({
      id: post.id,
      parentId: post.parentId || null,
      authorId: post.authorId,
      authorName: post.author?.name || null,
      authorAnonymousId: post.author?.anonymousId || null,
      content: post.content,
      tags: post.tags || [],
      course: post.course || null,
      isAnonymous: post.isAnonymous,
      reactions: post.reactions || {},
      createdAt: post.createdAt,
    }));
  }

  private async exportResourcesDataset(classroomId: string) {
    const resources = await this.resourceRepo
      .createQueryBuilder('resource')
      .leftJoinAndSelect('resource.uploader', 'uploader')
      .leftJoinAndSelect('resource.course', 'course')
      .where('resource.classroomId = :classroomId', { classroomId })
      .orderBy('resource.createdAt', 'ASC')
      .getMany();

    return resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      type: resource.type,
      course: resource.course
        ? {
            id: resource.course.id,
            code: resource.course.code,
            name: resource.course.name,
          }
        : null,
      uploader: resource.uploader
        ? {
            id: resource.uploader.id,
            name: resource.uploader.name,
            anonymousId: resource.uploader.anonymousId,
          }
        : null,
      fileName: resource.fileName,
      fileSize: resource.fileSize,
      fileUrl: resource.fileUrl,
      externalUrl: resource.externalUrl,
      tags: resource.tags || [],
      upvotes: resource.upvotes,
      downvotes: resource.downvotes,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
    }));
  }

  private async exportQuizzesDataset(classroomId: string) {
    const [quizzes, attempts, leaderboardRows] = await Promise.all([
      this.quizRepo
        .createQueryBuilder('quiz')
        .leftJoinAndSelect('quiz.author', 'author')
        .leftJoinAndSelect('quiz.questions', 'question')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .orderBy('quiz.createdAt', 'ASC')
        .addOrderBy('question.orderIndex', 'ASC')
        .getMany(),
      this.attemptRepo
        .createQueryBuilder('attempt')
        .innerJoinAndSelect('attempt.quiz', 'quiz')
        .leftJoinAndSelect('attempt.user', 'user')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .orderBy('attempt.completedAt', 'ASC')
        .getMany(),
      this.attemptRepo
        .createQueryBuilder('attempt')
        .innerJoin('attempt.quiz', 'quiz')
        .innerJoin('attempt.user', 'user')
        .select('user.id', 'userId')
        .addSelect('user.name', 'name')
        .addSelect('user.anonymousId', 'anonymousId')
        .addSelect('SUM(attempt.score)', 'xp')
        .addSelect('SUM(CASE WHEN attempt.won = 1 THEN 1 ELSE 0 END)', 'wins')
        .addSelect('COUNT(attempt.id)', 'attempts')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .groupBy('user.id')
        .addGroupBy('user.name')
        .addGroupBy('user.anonymousId')
        .orderBy('xp', 'DESC')
        .addOrderBy('wins', 'DESC')
        .getRawMany<{
          userId: string;
          name: string;
          anonymousId: string;
          xp: string;
          wins: string;
          attempts: string;
        }>(),
    ]);

    return {
      quizzes: quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        courseCode: quiz.courseCode,
        courseId: quiz.courseId,
        authorId: quiz.authorId,
        authorName: quiz.author?.name || null,
        isAnonymous: quiz.isAnonymous,
        isPublished: quiz.isPublished,
        maxAttempts: quiz.maxAttempts,
        createdAt: quiz.createdAt,
        questions: (quiz.questions || [])
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((question) => ({
            id: question.id,
            orderIndex: question.orderIndex,
            questionText: question.questionText,
            options: question.options,
            correctOptionIndex: question.correctOptionIndex,
            difficulty: question.difficulty,
            durationSeconds: question.durationSeconds,
          })),
      })),
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quizId,
        quizTitle: attempt.quiz?.title || null,
        userId: attempt.userId,
        userName: attempt.user?.name || null,
        userAnonymousId: attempt.user?.anonymousId || null,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        correctAnswers: attempt.correctAnswers,
        won: attempt.won,
        completedAt: attempt.completedAt,
      })),
      leaderboard: leaderboardRows.map((row, index) => ({
        rank: index + 1,
        userId: row.userId,
        name: row.name,
        anonymousId: row.anonymousId,
        xp: Number(row.xp || 0),
        wins: Number(row.wins || 0),
        attempts: Number(row.attempts || 0),
      })),
    };
  }

  private async exportAnalyticsDataset(classroomId: string) {
    const now = new Date();
    const endExclusive = this.addUtcDays(this.startOfUtcDay(now), 1);
    const startInclusive = this.addUtcDays(endExclusive, -AdminService.EXPORT_LOG_WINDOW_DAYS);
    const [summary, dailyActivity] = await Promise.all([
      this.getOwnerAnalytics(classroomId),
      this.getDailyActivityBreakdown(classroomId, startInclusive, endExclusive),
    ]);

    return {
      summary,
      dailyActivity,
      window: {
        startDate: this.toUtcDateKey(startInclusive),
        endDate: this.toUtcDateKey(this.addUtcDays(endExclusive, -1)),
        days: AdminService.EXPORT_LOG_WINDOW_DAYS,
      },
    };
  }

  private async getDailyActivityBreakdown(
    classroomId: string,
    startInclusive: Date,
    endExclusive: Date,
  ): Promise<
    {
      date: string;
      posts: number;
      resources: number;
      quizzes: number;
      attempts: number;
      activeUsers: number;
    }[]
  > {
    const [postsByDay, resourcesByDay, quizzesByDay, attemptsByDay, dailyActiveUsers] = await Promise.all([
      this.postRepo
        .createQueryBuilder('post')
        .select('DATE(post.createdAt)', 'dateKey')
        .addSelect('COUNT(post.id)', 'total')
        .where('post.classroomId = :classroomId', { classroomId })
        .andWhere('post.createdAt >= :startInclusive', { startInclusive })
        .andWhere('post.createdAt < :endExclusive', { endExclusive })
        .groupBy('DATE(post.createdAt)')
        .getRawMany<DailyCountRow>(),
      this.resourceRepo
        .createQueryBuilder('resource')
        .select('DATE(resource.createdAt)', 'dateKey')
        .addSelect('COUNT(resource.id)', 'total')
        .where('resource.classroomId = :classroomId', { classroomId })
        .andWhere('resource.createdAt >= :startInclusive', { startInclusive })
        .andWhere('resource.createdAt < :endExclusive', { endExclusive })
        .groupBy('DATE(resource.createdAt)')
        .getRawMany<DailyCountRow>(),
      this.quizRepo
        .createQueryBuilder('quiz')
        .select('DATE(quiz.createdAt)', 'dateKey')
        .addSelect('COUNT(quiz.id)', 'total')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .andWhere('quiz.createdAt >= :startInclusive', { startInclusive })
        .andWhere('quiz.createdAt < :endExclusive', { endExclusive })
        .groupBy('DATE(quiz.createdAt)')
        .getRawMany<DailyCountRow>(),
      this.attemptRepo
        .createQueryBuilder('attempt')
        .innerJoin('attempt.quiz', 'quiz')
        .select('DATE(attempt.completedAt)', 'dateKey')
        .addSelect('COUNT(attempt.id)', 'total')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .andWhere('attempt.completedAt >= :startInclusive', { startInclusive })
        .andWhere('attempt.completedAt < :endExclusive', { endExclusive })
        .groupBy('DATE(attempt.completedAt)')
        .getRawMany<DailyCountRow>(),
      this.getDailyActiveUsersByDate(classroomId, startInclusive, endExclusive),
    ]);

    const postsMap = new Map(postsByDay.map((row) => [row.dateKey, Number(row.total || 0)]));
    const resourcesMap = new Map(resourcesByDay.map((row) => [row.dateKey, Number(row.total || 0)]));
    const quizzesMap = new Map(quizzesByDay.map((row) => [row.dateKey, Number(row.total || 0)]));
    const attemptsMap = new Map(attemptsByDay.map((row) => [row.dateKey, Number(row.total || 0)]));

    const days = Math.max(
      1,
      Math.ceil((endExclusive.getTime() - startInclusive.getTime()) / (24 * 60 * 60 * 1000)),
    );

    return Array.from({ length: days }).map((_, offset) => {
      const date = this.addUtcDays(startInclusive, offset);
      const dateKey = this.toUtcDateKey(date);
      return {
        date: dateKey,
        posts: postsMap.get(dateKey) || 0,
        resources: resourcesMap.get(dateKey) || 0,
        quizzes: quizzesMap.get(dateKey) || 0,
        attempts: attemptsMap.get(dateKey) || 0,
        activeUsers: dailyActiveUsers.get(dateKey)?.size || 0,
      };
    });
  }

  private estimateDatasetSizeBytes(datasetId: OwnerExportDatasetId, recordCount: number): number {
    const count = Math.max(1, recordCount);
    if (datasetId === 'users') return 2048 + count * 520;
    if (datasetId === 'posts') return 3072 + count * 920;
    if (datasetId === 'resources') return 2048 + count * 760;
    if (datasetId === 'quizzes') return 4096 + count * 2400;
    return 4096 + count * 360;
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'classroom';
  }

  private async getDailyActiveUsersByDate(
    classroomId: string,
    startInclusive: Date,
    endExclusive: Date,
  ): Promise<Map<string, Set<string>>> {
    const [loungeEvents, resourceEvents, quizEvents, attemptEvents] = await Promise.all([
      this.postRepo
        .createQueryBuilder('post')
        .select('post.authorId', 'userId')
        .addSelect('DATE(post.createdAt)', 'dayKey')
        .where('post.classroomId = :classroomId', { classroomId })
        .andWhere('post.authorId IS NOT NULL')
        .andWhere('post.createdAt >= :startInclusive', { startInclusive })
        .andWhere('post.createdAt < :endExclusive', { endExclusive })
        .getRawMany<ActivityEventRow>(),
      this.resourceRepo
        .createQueryBuilder('resource')
        .select('resource.uploaderId', 'userId')
        .addSelect('DATE(resource.createdAt)', 'dayKey')
        .where('resource.classroomId = :classroomId', { classroomId })
        .andWhere('resource.uploaderId IS NOT NULL')
        .andWhere('resource.createdAt >= :startInclusive', { startInclusive })
        .andWhere('resource.createdAt < :endExclusive', { endExclusive })
        .getRawMany<ActivityEventRow>(),
      this.quizRepo
        .createQueryBuilder('quiz')
        .select('quiz.authorId', 'userId')
        .addSelect('DATE(quiz.createdAt)', 'dayKey')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .andWhere('quiz.authorId IS NOT NULL')
        .andWhere('quiz.createdAt >= :startInclusive', { startInclusive })
        .andWhere('quiz.createdAt < :endExclusive', { endExclusive })
        .getRawMany<ActivityEventRow>(),
      this.attemptRepo
        .createQueryBuilder('attempt')
        .innerJoin('attempt.quiz', 'quiz')
        .select('attempt.userId', 'userId')
        .addSelect('DATE(attempt.completedAt)', 'dayKey')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .andWhere('attempt.userId IS NOT NULL')
        .andWhere('attempt.completedAt >= :startInclusive', { startInclusive })
        .andWhere('attempt.completedAt < :endExclusive', { endExclusive })
        .getRawMany<ActivityEventRow>(),
    ]);

    const result = new Map<string, Set<string>>();
    const events = [...loungeEvents, ...resourceEvents, ...quizEvents, ...attemptEvents];

    for (const row of events) {
      if (!row.userId) continue;
      const set = result.get(row.dayKey) || new Set<string>();
      set.add(row.userId);
      result.set(row.dayKey, set);
    }

    return result;
  }

  private async getWeeklyActivity(
    classroomId: string,
    weekStartInclusive: Date,
    weekEndExclusive: Date,
  ): Promise<{ day: string; posts: number; resources: number; quizzes: number }[]> {
    const [postRows, resourceRows, quizRows] = await Promise.all([
      this.postRepo
        .createQueryBuilder('post')
        .select('DATE(post.createdAt)', 'dateKey')
        .addSelect('COUNT(post.id)', 'total')
        .where('post.classroomId = :classroomId', { classroomId })
        .andWhere('post.parentId IS NULL')
        .andWhere('post.createdAt >= :weekStartInclusive', { weekStartInclusive })
        .andWhere('post.createdAt < :weekEndExclusive', { weekEndExclusive })
        .groupBy('DATE(post.createdAt)')
        .getRawMany<{ dateKey: string; total: string }>(),
      this.resourceRepo
        .createQueryBuilder('resource')
        .select('DATE(resource.createdAt)', 'dateKey')
        .addSelect('COUNT(resource.id)', 'total')
        .where('resource.classroomId = :classroomId', { classroomId })
        .andWhere('resource.createdAt >= :weekStartInclusive', { weekStartInclusive })
        .andWhere('resource.createdAt < :weekEndExclusive', { weekEndExclusive })
        .groupBy('DATE(resource.createdAt)')
        .getRawMany<{ dateKey: string; total: string }>(),
      this.quizRepo
        .createQueryBuilder('quiz')
        .select('DATE(quiz.createdAt)', 'dateKey')
        .addSelect('COUNT(quiz.id)', 'total')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .andWhere('quiz.createdAt >= :weekStartInclusive', { weekStartInclusive })
        .andWhere('quiz.createdAt < :weekEndExclusive', { weekEndExclusive })
        .groupBy('DATE(quiz.createdAt)')
        .getRawMany<{ dateKey: string; total: string }>(),
    ]);

    const postMap = new Map(postRows.map((row) => [row.dateKey, Number(row.total || 0)]));
    const resourceMap = new Map(resourceRows.map((row) => [row.dateKey, Number(row.total || 0)]));
    const quizMap = new Map(quizRows.map((row) => [row.dateKey, Number(row.total || 0)]));

    return Array.from({ length: 7 }).map((_, dayIndex) => {
      const date = this.addUtcDays(weekStartInclusive, dayIndex);
      const key = this.toUtcDateKey(date);
      return {
        day: AdminService.DAY_LABELS[dayIndex],
        posts: postMap.get(key) || 0,
        resources: resourceMap.get(key) || 0,
        quizzes: quizMap.get(key) || 0,
      };
    });
  }

  private async getTopCourses(classroomId: string): Promise<{ code: string; name: string; engagement: number }[]> {
    const [courseRows, resourceRows, quizRows, attemptRows, loungeRows] = await Promise.all([
      this.courseRepo
        .createQueryBuilder('course')
        .select('UPPER(course.code)', 'code')
        .addSelect('course.name', 'name')
        .where('course.classroomId = :classroomId', { classroomId })
        .andWhere('course.code IS NOT NULL')
        .andWhere('TRIM(course.code) != \'\'')
        .getRawMany<{ code: string; name: string }>(),
      this.resourceRepo
        .createQueryBuilder('resource')
        .innerJoin('resource.course', 'course')
        .select('UPPER(course.code)', 'code')
        .addSelect('COUNT(resource.id)', 'total')
        .where('resource.classroomId = :classroomId', { classroomId })
        .andWhere('course.code IS NOT NULL')
        .andWhere('TRIM(course.code) != \'\'')
        .groupBy('UPPER(course.code)')
        .getRawMany<{ code: string; total: string }>(),
      this.quizRepo
        .createQueryBuilder('quiz')
        .select('UPPER(quiz.courseCode)', 'code')
        .addSelect('COUNT(quiz.id)', 'total')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .andWhere('quiz.courseCode IS NOT NULL')
        .andWhere('TRIM(quiz.courseCode) != \'\'')
        .groupBy('UPPER(quiz.courseCode)')
        .getRawMany<{ code: string; total: string }>(),
      this.attemptRepo
        .createQueryBuilder('attempt')
        .innerJoin('attempt.quiz', 'quiz')
        .select('UPPER(quiz.courseCode)', 'code')
        .addSelect('COUNT(attempt.id)', 'total')
        .where('quiz.classroomId = :classroomId', { classroomId })
        .andWhere('quiz.courseCode IS NOT NULL')
        .andWhere('TRIM(quiz.courseCode) != \'\'')
        .groupBy('UPPER(quiz.courseCode)')
        .getRawMany<{ code: string; total: string }>(),
      this.postRepo
        .createQueryBuilder('post')
        .select('UPPER(post.course)', 'code')
        .addSelect('COUNT(post.id)', 'total')
        .where('post.classroomId = :classroomId', { classroomId })
        .andWhere('post.parentId IS NULL')
        .andWhere('post.course IS NOT NULL')
        .andWhere('TRIM(post.course) != \'\'')
        .groupBy('UPPER(post.course)')
        .getRawMany<{ code: string; total: string }>(),
    ]);

    const courseNames = new Map<string, string>();
    for (const row of courseRows) {
      if (!row.code) continue;
      courseNames.set(row.code, row.name || row.code);
    }

    type CourseTotals = { code: string; name: string; resources: number; quizzes: number; attempts: number; lounge: number; score: number };
    const totals = new Map<string, CourseTotals>();

    const ensureCourse = (code: string): CourseTotals => {
      const existing = totals.get(code);
      if (existing) return existing;

      const created: CourseTotals = {
        code,
        name: courseNames.get(code) || code,
        resources: 0,
        quizzes: 0,
        attempts: 0,
        lounge: 0,
        score: 0,
      };
      totals.set(code, created);
      return created;
    };

    for (const row of resourceRows) {
      if (!row.code) continue;
      ensureCourse(row.code).resources = Number(row.total || 0);
    }
    for (const row of quizRows) {
      if (!row.code) continue;
      ensureCourse(row.code).quizzes = Number(row.total || 0);
    }
    for (const row of attemptRows) {
      if (!row.code) continue;
      ensureCourse(row.code).attempts = Number(row.total || 0);
    }
    for (const row of loungeRows) {
      if (!row.code) continue;
      ensureCourse(row.code).lounge = Number(row.total || 0);
    }

    for (const item of totals.values()) {
      item.score =
        item.resources * AdminService.TOP_COURSE_RESOURCE_WEIGHT +
        item.quizzes * AdminService.TOP_COURSE_QUIZ_WEIGHT +
        item.attempts * AdminService.TOP_COURSE_ATTEMPT_WEIGHT +
        item.lounge * AdminService.TOP_COURSE_LOUNGE_WEIGHT;
    }

    if (!totals.size) {
      return Array.from(courseNames.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 5)
        .map(([code, name]) => ({ code, name, engagement: 0 }));
    }

    const ranked = Array.from(totals.values())
      .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
      .slice(0, 5);

    const maxScore = ranked[0]?.score || 0;
    return ranked.map((item) => ({
      code: item.code,
      name: item.name,
      engagement: maxScore > 0 ? Math.round((item.score / maxScore) * 100) : 0,
    }));
  }

  private async getUserGrowth(
    classroomId: string,
    now: Date,
  ): Promise<{ month: string; users: number }[]> {
    const monthStarts = this.getTrailingUtcMonthStarts(now, 6);
    const windowStart = monthStarts[0];
    const windowEnd = this.addUtcMonths(monthStarts[monthStarts.length - 1], 1);

    const [beforeWindowTotal, monthlyRows] = await Promise.all([
      this.memberRepo
        .createQueryBuilder('member')
        .where('member.classroomId = :classroomId', { classroomId })
        .andWhere('member.joinedAt < :windowStart', { windowStart })
        .getCount(),
      this.memberRepo
        .createQueryBuilder('member')
        .select("DATE_FORMAT(member.joinedAt, '%Y-%m')", 'monthKey')
        .addSelect('COUNT(member.id)', 'total')
        .where('member.classroomId = :classroomId', { classroomId })
        .andWhere('member.joinedAt >= :windowStart', { windowStart })
        .andWhere('member.joinedAt < :windowEnd', { windowEnd })
        .groupBy("DATE_FORMAT(member.joinedAt, '%Y-%m')")
        .getRawMany<{ monthKey: string; total: string }>(),
    ]);

    const monthlyNewUsers = new Map(monthlyRows.map((row) => [row.monthKey, Number(row.total || 0)]));
    let runningTotal = beforeWindowTotal;

    return monthStarts.map((monthStart) => {
      const monthKey = this.toMonthKey(monthStart);
      runningTotal += monthlyNewUsers.get(monthKey) || 0;
      return {
        month: monthStart.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
        users: runningTotal,
      };
    });
  }

  private countDistinctUsers(dayMap: Map<string, Set<string>>): number {
    const users = new Set<string>();
    for (const dayUsers of dayMap.values()) {
      for (const userId of dayUsers) users.add(userId);
    }
    return users.size;
  }

  private averageDailyActive(
    dayMap: Map<string, Set<string>>,
    startDay: Date,
    dayCount: number,
  ): number {
    let total = 0;
    for (let i = 0; i < dayCount; i += 1) {
      const dayKey = this.toUtcDateKey(this.addUtcDays(startDay, i));
      total += dayMap.get(dayKey)?.size || 0;
    }
    return dayCount > 0 ? total / dayCount : 0;
  }

  private startOfUtcDay(date: Date): Date {
    const next = new Date(date);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  }

  private startOfUtcWeek(date: Date): Date {
    const dayStart = this.startOfUtcDay(date);
    const dayOfWeek = dayStart.getUTCDay(); // Sunday=0
    const diffToMonday = (dayOfWeek + 6) % 7;
    return this.addUtcDays(dayStart, -diffToMonday);
  }

  private addUtcDays(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + amount);
    return next;
  }

  private addUtcMonths(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setUTCMonth(next.getUTCMonth() + amount);
    return next;
  }

  private getTrailingUtcMonthStarts(date: Date, count: number): Date[] {
    const currentMonthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const result: Date[] = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      result.push(this.addUtcMonths(currentMonthStart, -i));
    }
    return result;
  }

  private toUtcDateKey(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 10);
  }

  private toMonthKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
