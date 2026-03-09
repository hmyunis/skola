import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement, PriorityLevel } from './entities/announcement.entity';
import { InviteCode } from './entities/invite-code.entity';
import { Classroom } from '../classrooms/entities/classroom.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Announcement) private announcementRepo: Repository<Announcement>,
    @InjectRepository(InviteCode) private inviteCodeRepo: Repository<InviteCode>,
    @InjectRepository(Classroom) private classroomRepo: Repository<Classroom>,
  ) {}

  async createAnnouncement(classroomId: string, authorId: string, data: { title: string; content: string; priority?: PriorityLevel }) {
    const announcement = this.announcementRepo.create({
      classroomId,
      authorId,
      title: data.title,
      content: data.content,
      priority: data.priority || PriorityLevel.NORMAL,
    });

    return this.announcementRepo.save(announcement);
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
