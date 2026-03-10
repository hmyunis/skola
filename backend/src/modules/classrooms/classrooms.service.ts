import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { Classroom } from './entities/classroom.entity';
import { ClassroomMember } from './entities/classroom-member.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { InviteCode } from '../admin/entities/invite-code.entity';

@Injectable()
export class ClassroomsService {
  private readonly logger = new Logger(ClassroomsService.name);

  constructor(
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
    @InjectRepository(ClassroomMember)
    private membersRepository: Repository<ClassroomMember>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(InviteCode)
    private inviteCodeRepository: Repository<InviteCode>,
    private configService: ConfigService,
    private httpService: HttpService,
    private jwtService: JwtService,
  ) {}

  async checkGroupMembership(telegramGroupId: string, telegramUserId: number): Promise<boolean> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not defined');
      return false;
    }

    const url = `https://api.telegram.org/bot${botToken.trim().replace(/^["']|["']$/g, '')}/getChatMember?chat_id=${telegramGroupId}&user_id=${telegramUserId}`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      const status = response.data.result?.status;
      const allowedStatuses = ['creator', 'administrator', 'member', 'restricted'];
      return allowedStatuses.includes(status);
    } catch (error) {
      this.logger.error(`Failed to check group membership for user ${telegramUserId} in group ${telegramGroupId}`, error.response?.data || error.message);
      return false;
    }
  }

  async onboardByTelegramGroupId(telegramGroupId: string, user: User): Promise<{ member: ClassroomMember; classroom: Classroom; user: User; accessToken: string }> {
    // 1. Validate format
    const tgIdRegex = /^-?\d+$/;
    if (!tgIdRegex.test(telegramGroupId)) {
      throw new BadRequestException('Invalid Telegram group ID format.');
    }

    // 2. Check if classroom already exists
    const existingClassroom = await this.classroomsRepository.findOne({ where: { telegramGroupId } });
    if (existingClassroom) {
      throw new BadRequestException('A classroom already exists for this Telegram group. Please join using an invite code from the owner.');
    }

    // 3. Verify membership in the group
    const isMember = await this.checkGroupMembership(telegramGroupId, user.telegramId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this Telegram group. Please join the group first.');
    }

    // 4. Create classroom (User becomes OWNER)
    const classroom = this.classroomsRepository.create({
      telegramGroupId,
      name: `Classroom ${telegramGroupId}`,
      inviteCode: this.generateInviteCode(),
      isActive: true,
    });
    const savedClassroom = await this.classroomsRepository.save(classroom);

    // Update user's global role to OWNER
    user.role = UserRole.OWNER;
    await this.usersRepository.save(user);

    // Create the membership
    const member = this.membersRepository.create({
      classroom: savedClassroom,
      user,
      role: UserRole.OWNER
    });
    const savedMember = await this.membersRepository.save(member);

    // Generate fresh JWT
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      member: savedMember,
      classroom: savedClassroom,
      user,
      accessToken
    };
  }

  async createClassroom(data: Partial<Classroom>, user: User): Promise<{ classroom: Classroom; inviteCode: string; user: User }> {
    // Generate unique invite code
    const inviteCode = this.generateInviteCode();
    
    const classroom = this.classroomsRepository.create({ 
      ...data, 
      inviteCode,
      isActive: true 
    });
    const savedClassroom = await this.classroomsRepository.save(classroom);

    // Automatically add the creator as the OWNER
    const member = this.membersRepository.create({
      classroom: savedClassroom,
      user,
      role: UserRole.OWNER
    });
    await this.membersRepository.save(member);

    // Update user's global role if they are not already an owner
    if (user.role !== UserRole.OWNER) {
      await this.usersRepository.update(user.id, { role: UserRole.OWNER });
      user.role = UserRole.OWNER;
    }

    return { 
      classroom: savedClassroom, 
      inviteCode,
      user
    };
  }

  async getClassroomById(id: string): Promise<Classroom> {
    const classroom = await this.classroomsRepository.findOne({ 
      where: { id },
      relations: ['members', 'members.user']
    });
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }
    return classroom;
  }

  async updateTheme(id: string, theme: any): Promise<Classroom> {
    const classroom = await this.classroomsRepository.findOne({ where: { id } });
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }
    classroom.theme = theme;
    return this.classroomsRepository.save(classroom);
  }

  async joinClassroom(inviteCode: string, user: User): Promise<{ member: ClassroomMember; classroom: Classroom; user: User; accessToken: string }> {
    let classroom: Classroom | null = null;
    let inviteEntity: InviteCode | null = null;

    // 1. Try to find a dynamic invite code from the admin module
    inviteEntity = await this.inviteCodeRepository.findOne({
      where: { code: inviteCode, isActive: true },
      relations: ['classroom']
    });

    if (inviteEntity) {
      // Check for expiration
      if (inviteEntity.expiresAt && new Date() > inviteEntity.expiresAt) {
        inviteEntity.isActive = false;
        await this.inviteCodeRepository.save(inviteEntity);
        throw new BadRequestException('Invite code has expired');
      }

      // Check for max uses
      if (inviteEntity.maxUses && inviteEntity.uses >= inviteEntity.maxUses) {
        inviteEntity.isActive = false;
        await this.inviteCodeRepository.save(inviteEntity);
        throw new BadRequestException('Invite code has reached its maximum uses');
      }

      classroom = inviteEntity.classroom;
    } else {
      // 2. Fallback to default classroom invite code (permanent code)
      classroom = await this.classroomsRepository.findOne({ 
        where: { inviteCode, isActive: true }
      });
    }
    
    if (!classroom) {
      throw new BadRequestException('Invalid or inactive invite code');
    }

    // 3. Verify membership in the Telegram group
    const isMember = await this.checkGroupMembership(classroom.telegramGroupId, user.telegramId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this classroom\'s Telegram group. Please join the group first.');
    }

    // 4. Check if user is already a member of the classroom
    const existingMember = await this.membersRepository.findOne({
      where: { classroom: { id: classroom.id }, user: { id: user.id } }
    });

    if (existingMember) {
      throw new BadRequestException('Already a member of this classroom');
    }

    const member = this.membersRepository.create({
      classroom,
      user,
      role: UserRole.STUDENT
    });

    const savedMember = await this.membersRepository.save(member);

    // 5. Increment uses if it was a dynamic invite code
    if (inviteEntity) {
      inviteEntity.uses++;
      if (inviteEntity.maxUses && inviteEntity.uses >= inviteEntity.maxUses) {
        inviteEntity.isActive = false;
      }
      await this.inviteCodeRepository.save(inviteEntity);
    }

    // Return consistent payload
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      member: savedMember,
      classroom,
      user,
      accessToken
    };
  }

  async getUserClassrooms(userId: string): Promise<{ classrooms: Classroom[]; user: User }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const members = await this.membersRepository.find({
      where: { user: { id: userId } },
      relations: ['classroom']
    });

    const classrooms = members.map(member => member.classroom);
    return { classrooms, user };
  }

  async getClassroomMembers(classroomId: string): Promise<ClassroomMember[]> {
    return this.membersRepository.find({
      where: { classroom: { id: classroomId } },
      relations: ['user']
    });
  }

  async updateMemberStatus(memberId: string, dto: { status: 'active' | 'suspended' | 'banned'; suspendedUntil?: Date }): Promise<ClassroomMember> {
    const member = await this.membersRepository.findOne({
      where: { id: memberId },
      relations: ['user']
    });
    if (!member) throw new NotFoundException('Member not found');

    const user = member.user;
    if (dto.status === 'banned') {
      user.isBanned = true;
      user.suspendedUntil = null as any;
    } else if (dto.status === 'suspended') {
      user.isBanned = false;
      user.suspendedUntil = dto.suspendedUntil || null as any;
    } else {
      user.isBanned = false;
      user.suspendedUntil = null as any;
    }

    await this.usersRepository.save(user);
    return member;
  }

  async updateMemberRole(memberId: string, dto: { role: UserRole }): Promise<ClassroomMember> {
    const member = await this.membersRepository.findOne({
      where: { id: memberId },
      relations: ['user']
    });
    if (!member) throw new NotFoundException('Member not found');

    // Update the role in this specific classroom
    member.role = dto.role;
    
    // Also update the global user role to ensure correct UI visibility on login.
    // We only upgrade the role (e.g., student -> admin), we don't downgrade it 
    // globally if they are still an admin in another classroom.
    // For simplicity, we'll sync the role if it's an upgrade.
    const user = member.user;
    if (dto.role === UserRole.OWNER) {
      user.role = UserRole.OWNER;
    } else if (dto.role === UserRole.ADMIN && user.role === UserRole.STUDENT) {
      user.role = UserRole.ADMIN;
    }
    
    await this.usersRepository.save(user);
    return this.membersRepository.save(member);
  }

  async removeMember(memberId: string): Promise<void> {
    const member = await this.membersRepository.findOne({ where: { id: memberId } });
    if (!member) {
      throw new NotFoundException('Member not found');
    }
    await this.membersRepository.remove(member);
  }

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
