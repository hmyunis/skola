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

  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
