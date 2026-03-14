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

interface UpsertAnnouncementDto {
  title: string;
  content: string;
  priority?: PriorityLevel;
  targetAudience?: AnnouncementTargetAudience;
  pinned?: boolean;
  expiresAt?: string | Date;
  sendTelegram?: boolean;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private static readonly SURPRISE_ASSESSMENT_TITLE = 'Surprise Assessment Alarm';

  constructor(
    @InjectRepository(Announcement) private announcementRepo: Repository<Announcement>,
    @InjectRepository(InviteCode) private inviteCodeRepo: Repository<InviteCode>,
    @InjectRepository(Classroom) private classroomRepo: Repository<Classroom>,
    @InjectRepository(ClassroomMember) private memberRepo: Repository<ClassroomMember>,
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

  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
