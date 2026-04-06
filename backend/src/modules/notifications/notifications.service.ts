import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { In, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import * as webpush from 'web-push';
import {
  Announcement,
  AnnouncementTargetAudience,
} from '../admin/entities/announcement.entity';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import {
  User,
  UserNotificationPreferences,
  UserRole,
} from '../users/entities/user.entity';
import { InAppNotification } from './entities/in-app-notification.entity';
import { WebPushSubscription } from './entities/web-push-subscription.entity';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { CreateWebPushSubscriptionDto } from './dto/create-web-push-subscription.dto';

export interface NotificationPreferenceResponse {
  inAppAnnouncements: boolean;
  browserPushAnnouncements: boolean;
  botDmAnnouncements: boolean;
}

export interface InAppNotificationResponse {
  id: string;
  kind: string;
  title: string;
  body: string;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  payload: Record<string, unknown> | null;
}

interface DispatchAnnouncementOptions {
  classroomId: string;
  announcement: Announcement;
  actorUserId?: string | null;
}

interface DispatchLoungeMentionOptions {
  classroomId: string;
  postId: string;
  content: string;
  authorId: string;
  authorDisplayName: string;
  recipientUserIds: string[];
  mentionedEveryone: boolean;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  data: Record<string, unknown>;
}

export type NotificationTestType = 'announcement' | 'mention';

export interface NotificationTestResponse {
  type: NotificationTestType;
  inApp: 'sent' | 'skipped_disabled';
  browserPush:
    | 'sent'
    | 'skipped_disabled'
    | 'skipped_unconfigured'
    | 'skipped_unsubscribed';
  botDm:
    | 'sent'
    | 'skipped_disabled'
    | 'skipped_unconfigured'
    | 'skipped_missing_telegram';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly vapidPublicKey: string | null;
  private readonly vapidPrivateKey: string | null;
  private readonly vapidSubject: string | null;
  private readonly telegramBotToken: string | null;

  private static readonly DEFAULT_PREFERENCES: NotificationPreferenceResponse =
    {
      inAppAnnouncements: true,
      browserPushAnnouncements: false,
      botDmAnnouncements: false,
    };

  constructor(
    @InjectRepository(ClassroomMember)
    private readonly membersRepository: Repository<ClassroomMember>,
    @InjectRepository(InAppNotification)
    private readonly inAppNotificationsRepository: Repository<InAppNotification>,
    @InjectRepository(WebPushSubscription)
    private readonly webPushSubscriptionsRepository: Repository<WebPushSubscription>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.vapidPublicKey = this.sanitizeConfigValue(
      this.configService.get<string>('VAPID_PUBLIC_KEY'),
    );
    this.vapidPrivateKey = this.sanitizeConfigValue(
      this.configService.get<string>('VAPID_PRIVATE_KEY'),
    );
    this.vapidSubject = this.sanitizeConfigValue(
      this.configService.get<string>('VAPID_SUBJECT'),
    );
    this.telegramBotToken = this.sanitizeConfigValue(
      this.configService.get<string>('TELEGRAM_BOT_TOKEN'),
    );

    if (this.isWebPushConfigured()) {
      webpush.setVapidDetails(
        this.vapidSubject as string,
        this.vapidPublicKey as string,
        this.vapidPrivateKey as string,
      );
    } else {
      this.logger.warn(
        'Web push is not fully configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.',
      );
    }
  }

  async getUserPreferences(
    userId: string,
    classroomId: string,
  ): Promise<NotificationPreferenceResponse> {
    const member = await this.membersRepository.findOne({
      where: { classroom: { id: classroomId }, user: { id: userId } },
    });
    if (!member)
      throw new NotFoundException('User not found in this classroom');
    return this.normalizePreferences(member.notificationPreferences);
  }

  async updateUserPreferences(
    userId: string,
    classroomId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferenceResponse> {
    const member = await this.membersRepository.findOne({
      where: { classroom: { id: classroomId }, user: { id: userId } },
    });
    if (!member)
      throw new NotFoundException('User not found in this classroom');

    const current = this.normalizePreferences(member.notificationPreferences);
    const next: NotificationPreferenceResponse = {
      inAppAnnouncements:
        dto.inAppAnnouncements === undefined
          ? current.inAppAnnouncements
          : dto.inAppAnnouncements,
      browserPushAnnouncements:
        dto.browserPushAnnouncements === undefined
          ? current.browserPushAnnouncements
          : dto.browserPushAnnouncements,
      botDmAnnouncements:
        dto.botDmAnnouncements === undefined
          ? current.botDmAnnouncements
          : dto.botDmAnnouncements,
    };

    member.notificationPreferences = next;
    await this.membersRepository.save(member);
    return next;
  }

  getWebPushClientConfig(): { configured: boolean; publicKey: string | null } {
    return {
      configured: this.isWebPushConfigured(),
      publicKey: this.vapidPublicKey,
    };
  }

  async sendTestNotification(
    userId: string,
    type: NotificationTestType,
    classroomId: string,
  ): Promise<NotificationTestResponse> {
    const member = await this.membersRepository.findOne({
      where: { classroom: { id: classroomId }, user: { id: userId } },
      relations: ['user'],
    });
    const user = member?.user || null;
    if (!user) {
      throw new NotFoundException('User not found in this classroom');
    }

    const preferences = this.normalizePreferences(
      member?.notificationPreferences,
    );
    const targetClassroomId = classroomId;

    const now = Date.now();
    const isAnnouncementTest = type === 'announcement';
    const kind = isAnnouncementTest ? 'announcement' : 'lounge_mention';
    const title = isAnnouncementTest
      ? '[TEST] Announcement notification'
      : '[TEST] Lounge mention notification';
    const body = isAnnouncementTest
      ? 'This is a test announcement notification from SKOLA.'
      : 'This is a test lounge mention notification from SKOLA.';
    const route = isAnnouncementTest ? '/announcements' : '/lounge';
    const tag = isAnnouncementTest
      ? `test-announcement-${now}`
      : `test-lounge-mention-${now}`;
    const payloadData: Record<string, unknown> = isAnnouncementTest
      ? {
          notificationType: 'test_announcement',
          isTest: true,
          classroomId: targetClassroomId,
        }
      : {
          notificationType: 'test_lounge_mention',
          isTest: true,
          classroomId: targetClassroomId,
          postId: `test-${now}`,
        };

    const result: NotificationTestResponse = {
      type,
      inApp: preferences.inAppAnnouncements ? 'sent' : 'skipped_disabled',
      browserPush: preferences.browserPushAnnouncements
        ? 'skipped_unconfigured'
        : 'skipped_disabled',
      botDm: preferences.botDmAnnouncements
        ? 'skipped_unconfigured'
        : 'skipped_disabled',
    };

    if (preferences.inAppAnnouncements) {
      await this.inAppNotificationsRepository.save(
        this.inAppNotificationsRepository.create({
          userId: user.id,
          classroomId: targetClassroomId,
          kind,
          title,
          body,
          payload: {
            ...payloadData,
            route,
          },
          isRead: false,
          readAt: null,
        }),
      );
    }

    if (preferences.browserPushAnnouncements) {
      if (this.isWebPushConfigured()) {
        const sentCount = await this.sendBrowserPushToUserIds([user.id], {
          title,
          body,
          url: route,
          tag,
          data: payloadData,
        });
        result.browserPush = sentCount > 0 ? 'sent' : 'skipped_unsubscribed';
      } else {
        result.browserPush = 'skipped_unconfigured';
      }
    }

    if (preferences.botDmAnnouncements) {
      if (!this.telegramBotToken) {
        result.botDm = 'skipped_unconfigured';
      } else if (!user.telegramId) {
        result.botDm = 'skipped_missing_telegram';
      } else {
        const link = this.buildFrontendLink(route);
        const text = isAnnouncementTest
          ? `Test notification: announcement\n\n${title}\n\n${body}${link ? `\n\nOpen: ${link}` : ''}`
          : `Test notification: lounge mention\n\n${title}\n\n${body}${link ? `\n\nOpen: ${link}` : ''}`;
        const sentCount = await this.sendTelegramDmToUsers([user], text);
        result.botDm = sentCount > 0 ? 'sent' : 'skipped_missing_telegram';
      }
    }

    return result;
  }

  async saveWebPushSubscription(
    userId: string,
    dto: CreateWebPushSubscriptionDto,
  ): Promise<{ success: true }> {
    if (!this.isWebPushConfigured()) {
      throw new BadRequestException(
        'Web push is not configured on the server. Missing VAPID keys.',
      );
    }

    const endpoint = (dto.endpoint || '').trim();
    const p256dh = (dto.keys?.p256dh || '').trim();
    const auth = (dto.keys?.auth || '').trim();

    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException('Invalid push subscription payload.');
    }

    const existingByEndpoint =
      await this.webPushSubscriptionsRepository.findOne({
        where: { endpoint },
      });

    if (existingByEndpoint) {
      existingByEndpoint.userId = userId;
      existingByEndpoint.p256dh = p256dh;
      existingByEndpoint.auth = auth;
      existingByEndpoint.expirationTime =
        dto.expirationTime === null || dto.expirationTime === undefined
          ? null
          : String(dto.expirationTime);
      existingByEndpoint.userAgent = (dto.userAgent || '').trim() || null;
      await this.webPushSubscriptionsRepository.save(existingByEndpoint);
      return { success: true };
    }

    const created = this.webPushSubscriptionsRepository.create({
      userId,
      endpoint,
      p256dh,
      auth,
      expirationTime:
        dto.expirationTime === null || dto.expirationTime === undefined
          ? null
          : String(dto.expirationTime),
      userAgent: (dto.userAgent || '').trim() || null,
    });

    await this.webPushSubscriptionsRepository.save(created);
    return { success: true };
  }

  async removeWebPushSubscription(
    userId: string,
    endpointRaw: string,
  ): Promise<{ success: true }> {
    const endpoint = (endpointRaw || '').trim();
    if (!endpoint) {
      return { success: true };
    }

    await this.webPushSubscriptionsRepository.delete({
      userId,
      endpoint,
    });
    return { success: true };
  }

  async listInAppNotifications(
    userId: string,
    classroomId: string,
    limitRaw?: number,
  ): Promise<{ items: InAppNotificationResponse[]; unreadCount: number }> {
    const limit = this.clampLimit(limitRaw);
    const [rows, unreadCount] = await Promise.all([
      this.inAppNotificationsRepository.find({
        where: { userId, classroomId },
        order: { createdAt: 'DESC' },
        take: limit,
      }),
      this.inAppNotificationsRepository.count({
        where: { userId, classroomId, isRead: false },
      }),
    ]);

    return {
      unreadCount,
      items: rows.map((row) => this.toInAppNotificationResponse(row)),
    };
  }

  async markInAppNotificationAsRead(
    userId: string,
    classroomId: string,
    notificationId: string,
  ): Promise<{ success: true }> {
    const row = await this.inAppNotificationsRepository.findOne({
      where: { id: notificationId, userId, classroomId },
    });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }

    if (!row.isRead) {
      row.isRead = true;
      row.readAt = new Date();
      await this.inAppNotificationsRepository.save(row);
    }

    return { success: true };
  }

  async markAllInAppNotificationsAsRead(
    userId: string,
    classroomId: string,
  ): Promise<{ success: true }> {
    await this.inAppNotificationsRepository
      .createQueryBuilder()
      .update(InAppNotification)
      .set({ isRead: true, readAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('classroomId = :classroomId', { classroomId })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();

    return { success: true };
  }

  async dismissInAppNotification(
    userId: string,
    classroomId: string,
    notificationId: string,
  ): Promise<{ success: true }> {
    const result = await this.inAppNotificationsRepository.delete({
      id: notificationId,
      userId,
      classroomId,
    });

    if (!result.affected) {
      throw new NotFoundException('Notification not found');
    }

    return { success: true };
  }

  async dispatchAnnouncementNotifications(
    options: DispatchAnnouncementOptions,
  ): Promise<void> {
    const { classroomId, announcement, actorUserId } = options;

    const members = await this.membersRepository.find({
      where: { classroom: { id: classroomId } },
      relations: ['user'],
    });

    if (!members.length) {
      return;
    }

    const recipients = members
      .filter((member) =>
        this.shouldReceiveAudience(member.role, announcement.targetAudience),
      )
      .filter((member) => Boolean(member.user))
      .filter((member) => member.user.id !== actorUserId);

    if (!recipients.length) {
      return;
    }

    const inAppRows = recipients
      .filter(
        (member) =>
          this.normalizePreferences(member.notificationPreferences)
            .inAppAnnouncements,
      )
      .map((member) =>
        this.inAppNotificationsRepository.create({
          userId: member.user.id,
          classroomId,
          kind: 'announcement',
          title: announcement.title,
          body: announcement.content,
          payload: {
            announcementId: announcement.id,
            route: '/announcements',
            priority: announcement.priority,
            classroomId,
          },
          isRead: false,
          readAt: null,
        }),
      );

    if (inAppRows.length) {
      await this.inAppNotificationsRepository.save(inAppRows);
    }

    const pushPayload: PushPayload = {
      title: `[${announcement.priority.toUpperCase()}] ${announcement.title}`,
      body: announcement.content,
      url: '/announcements',
      tag: `announcement-${announcement.id}`,
      data: {
        classroomId,
        announcementId: announcement.id,
        priority: announcement.priority,
      },
    };

    const pushUserIds = recipients
      .filter(
        (member) =>
          this.normalizePreferences(member.notificationPreferences)
            .browserPushAnnouncements,
      )
      .map((member) => member.user.id);

    const priorityLabel = announcement.priority.toUpperCase();
    const link = this.buildFrontendLink('/announcements');
    const announcementDmText = `New announcement (${priorityLabel})\n\n${announcement.title}\n\n${announcement.content}${
      link ? `\n\nOpen: ${link}` : ''
    }`;
    const botRecipients = recipients
      .filter((member) => {
        const wantsDm = this.normalizePreferences(
          member.notificationPreferences,
        ).botDmAnnouncements;
        return wantsDm && Boolean(member.user.telegramId);
      })
      .map((member) => member.user);

    await Promise.all([
      this.sendBrowserPushToUserIds(pushUserIds, pushPayload),
      this.sendTelegramDmToUsers(botRecipients, announcementDmText),
    ]);
  }

  async dispatchLoungeMentionNotifications(
    options: DispatchLoungeMentionOptions,
  ): Promise<void> {
    const {
      classroomId,
      postId,
      content,
      authorId,
      authorDisplayName,
      recipientUserIds,
      mentionedEveryone,
    } = options;

    const uniqueRecipientIds = Array.from(new Set(recipientUserIds)).filter(
      (userId) => Boolean(userId) && userId !== authorId,
    );
    if (!uniqueRecipientIds.length) {
      return;
    }

    const recipientMembers = await this.membersRepository.find({
      where: {
        classroom: { id: classroomId },
        user: { id: In(uniqueRecipientIds) },
      },
      relations: ['user'],
    });
    if (!recipientMembers.length) {
      return;
    }

    const title = mentionedEveryone
      ? `${authorDisplayName} mentioned everyone in Lounge`
      : `${authorDisplayName} mentioned you in Lounge`;

    const normalizedBody = (content || '').trim().replace(/\s+/g, ' ');
    const fallbackBody = mentionedEveryone
      ? 'A new Lounge post tagged @everyone.'
      : 'A Lounge post mentioned you.';
    const body =
      normalizedBody.length > 0 ? normalizedBody.slice(0, 240) : fallbackBody;

    const inAppRows = recipientMembers
      .filter(
        (member) =>
          this.normalizePreferences(member.notificationPreferences)
            .inAppAnnouncements,
      )
      .map((member) =>
        this.inAppNotificationsRepository.create({
          userId: member.user.id,
          classroomId,
          kind: 'lounge_mention',
          title,
          body,
          payload: {
            route: '/lounge',
            postId,
            authorId,
            mentionedEveryone,
            notificationType: 'lounge_mention',
          },
          isRead: false,
          readAt: null,
        }),
      );

    if (inAppRows.length) {
      await this.inAppNotificationsRepository.save(inAppRows);
    }

    const pushPayload: PushPayload = {
      title,
      body,
      url: '/lounge',
      tag: `lounge-mention-${postId}`,
      data: {
        classroomId,
        postId,
        authorId,
        mentionedEveryone,
        notificationType: 'lounge_mention',
      },
    };
    const pushUserIds = recipientMembers
      .filter(
        (member) =>
          this.normalizePreferences(member.notificationPreferences)
            .browserPushAnnouncements,
      )
      .map((member) => member.user.id);

    const link = this.buildFrontendLink('/lounge');
    const mentionText = `${title}\n\n${body}${link ? `\n\nOpen: ${link}` : ''}`;
    const botRecipients = recipientMembers
      .filter((member) => {
        const wantsDm = this.normalizePreferences(
          member.notificationPreferences,
        ).botDmAnnouncements;
        return wantsDm && Boolean(member.user.telegramId);
      })
      .map((member) => member.user);

    await Promise.all([
      this.sendBrowserPushToUserIds(pushUserIds, pushPayload),
      this.sendTelegramDmToUsers(botRecipients, mentionText),
    ]);
  }

  private async sendBrowserPushToUserIds(
    userIds: string[],
    payload: PushPayload,
  ): Promise<number> {
    if (!this.isWebPushConfigured() || !userIds.length) {
      return 0;
    }

    const subscriptions = await this.webPushSubscriptionsRepository
      .createQueryBuilder('subscription')
      .where('subscription.userId IN (:...userIds)', { userIds })
      .getMany();

    if (!subscriptions.length) {
      return 0;
    }

    const serializedPayload = JSON.stringify(payload);
    const sendResults = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              expirationTime: subscription.expirationTime
                ? Number(subscription.expirationTime)
                : null,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            serializedPayload,
            { TTL: 60 },
          );
          return true;
        } catch (error: any) {
          const statusCode = Number(error?.statusCode || error?.status || 0);
          if (statusCode === 404 || statusCode === 410) {
            await this.webPushSubscriptionsRepository.delete({
              id: subscription.id,
            });
            return false;
          }

          this.logger.warn(
            `Web push dispatch failed for subscription ${subscription.id}: ${
              error?.message || 'unknown error'
            }`,
          );
          return false;
        }
      }),
    );

    return sendResults.filter(Boolean).length;
  }

  private async sendTelegramDmToUsers(
    recipients: User[],
    text: string,
  ): Promise<number> {
    if (!this.telegramBotToken || !recipients.length) {
      return 0;
    }

    const results = await Promise.all(
      recipients.map(async (user) => {
        if (!user.telegramId) {
          return false;
        }
        try {
          await this.sendTelegramPrivateMessage(user.telegramId, text);
          return true;
        } catch (error: any) {
          this.logger.warn(
            `Telegram DM notification failed for user ${user.id}: ${
              error?.message || 'unknown error'
            }`,
          );
          return false;
        }
      }),
    );

    return results.filter(Boolean).length;
  }

  private async sendTelegramPrivateMessage(
    telegramId: number,
    text: string,
  ): Promise<void> {
    if (!this.telegramBotToken) {
      return;
    }
    const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;

    await firstValueFrom(
      this.httpService.post(url, {
        chat_id: String(telegramId),
        text,
        disable_web_page_preview: true,
      }),
    );
  }

  private shouldReceiveAudience(
    role: UserRole,
    audience: AnnouncementTargetAudience,
  ): boolean {
    if (audience === AnnouncementTargetAudience.ALL) return true;
    if (audience === AnnouncementTargetAudience.STUDENTS)
      return role === UserRole.STUDENT;
    return role === UserRole.ADMIN || role === UserRole.OWNER;
  }

  private normalizePreferences(
    raw: UserNotificationPreferences | null | undefined,
  ): NotificationPreferenceResponse {
    return {
      inAppAnnouncements:
        raw?.inAppAnnouncements === undefined
          ? NotificationsService.DEFAULT_PREFERENCES.inAppAnnouncements
          : Boolean(raw.inAppAnnouncements),
      browserPushAnnouncements:
        raw?.browserPushAnnouncements === undefined
          ? NotificationsService.DEFAULT_PREFERENCES.browserPushAnnouncements
          : Boolean(raw.browserPushAnnouncements),
      botDmAnnouncements:
        raw?.botDmAnnouncements === undefined
          ? NotificationsService.DEFAULT_PREFERENCES.botDmAnnouncements
          : Boolean(raw.botDmAnnouncements),
    };
  }

  private toInAppNotificationResponse(
    row: InAppNotification,
  ): InAppNotificationResponse {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      isRead: row.isRead,
      readAt: row.readAt,
      createdAt: row.createdAt,
      payload: row.payload || null,
    };
  }

  private clampLimit(limitRaw?: number) {
    if (!Number.isFinite(limitRaw)) return 30;
    return Math.max(1, Math.min(100, Number(limitRaw)));
  }

  private sanitizeConfigValue(value?: string | null) {
    const trimmed = (value || '').trim().replace(/^["']|["']$/g, '');
    return trimmed || null;
  }

  private buildFrontendLink(route: string): string | null {
    const frontendUrlRaw = this.sanitizeConfigValue(
      this.configService.get<string>('FRONTEND_URL'),
    );
    if (!frontendUrlRaw) {
      return null;
    }
    return `${frontendUrlRaw.replace(/\/+$/, '')}${route}`;
  }

  private isWebPushConfigured() {
    return Boolean(
      this.vapidPublicKey && this.vapidPrivateKey && this.vapidSubject,
    );
  }
}
