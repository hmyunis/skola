import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { Classroom } from './entities/classroom.entity';
import {
  ClassroomMember,
  ClassroomMemberStatus,
} from './entities/classroom-member.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { InviteCode } from '../admin/entities/invite-code.entity';

@Injectable()
export class ClassroomsService {
  private readonly logger = new Logger(ClassroomsService.name);
  private static readonly DEFAULT_PATTERN_INTENSITY = 0.25;

  private toClassroomSafeUser(
    user: User,
    role: UserRole = UserRole.STUDENT,
  ): User {
    const safeUser = Object.assign(new User(), user);
    safeUser.role = role;
    safeUser.isBanned = false;
    (safeUser as any).suspendedUntil = null;
    (safeUser as any).themeSettings = null;
    safeUser.notificationPreferences = null;
    safeUser.usePersonalImgBbApiKey = false;
    safeUser.imgbbApiKeyHint = null;
    return safeUser;
  }

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

  async checkGroupMembership(
    telegramGroupId: string,
    telegramUserId: number,
  ): Promise<boolean> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not defined');
      return false;
    }

    const url = `https://api.telegram.org/bot${botToken.trim().replace(/^["']|["']$/g, '')}/getChatMember?chat_id=${telegramGroupId}&user_id=${telegramUserId}`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      const status = response.data.result?.status;
      const allowedStatuses = [
        'creator',
        'administrator',
        'member',
        'restricted',
      ];
      return allowedStatuses.includes(status);
    } catch (error) {
      this.logger.error(
        `Failed to check group membership for user ${telegramUserId} in group ${telegramGroupId}`,
        error.response?.data || error.message,
      );
      return false;
    }
  }

  async onboardByTelegramGroupId(
    telegramGroupId: string,
    user: User,
  ): Promise<{
    member: ClassroomMember;
    classroom: Classroom;
    user: User;
    accessToken: string;
  }> {
    // 1. Validate format
    const tgIdRegex = /^-?\d+$/;
    if (!tgIdRegex.test(telegramGroupId)) {
      throw new BadRequestException('Invalid Telegram group ID format.');
    }

    // 2. Check if classroom already exists
    const existingClassroom = await this.classroomsRepository.findOne({
      where: { telegramGroupId },
    });
    if (existingClassroom) {
      throw new BadRequestException(
        'A classroom already exists for this Telegram group. Please join using an invite code from the owner.',
      );
    }

    // 3. Verify membership in the group
    const isMember = await this.checkGroupMembership(
      telegramGroupId,
      user.telegramId,
    );
    if (!isMember) {
      throw new ForbiddenException(
        'You are not a member of this Telegram group. Please join the group first.',
      );
    }

    // 4. Create classroom (User becomes OWNER)
    const classroom = this.classroomsRepository.create({
      telegramGroupId,
      name: `Classroom ${telegramGroupId}`,
      inviteCode: this.generateInviteCode(),
      isActive: true,
    });
    const savedClassroom = await this.classroomsRepository.save(classroom);

    // Create the membership
    const member = this.membersRepository.create({
      classroom: savedClassroom,
      user,
      role: UserRole.OWNER,
    });
    const savedMember = await this.membersRepository.save(member);

    // Generate fresh JWT
    const payload = { sub: user.id };
    const accessToken = this.jwtService.sign(payload);

    return {
      member: savedMember,
      classroom: savedClassroom,
      user: this.toClassroomSafeUser(user, UserRole.OWNER),
      accessToken,
    };
  }

  async createClassroom(
    data: Partial<Classroom>,
    user: User,
  ): Promise<{ classroom: Classroom; inviteCode: string; user: User }> {
    // Generate unique invite code
    const inviteCode = this.generateInviteCode();

    const classroom = this.classroomsRepository.create({
      ...data,
      inviteCode,
      isActive: true,
    });
    const savedClassroom = await this.classroomsRepository.save(classroom);

    // Automatically add the creator as the OWNER
    const member = this.membersRepository.create({
      classroom: savedClassroom,
      user,
      role: UserRole.OWNER,
    });
    await this.membersRepository.save(member);

    return {
      classroom: savedClassroom,
      inviteCode,
      user: this.toClassroomSafeUser(user, UserRole.OWNER),
    };
  }

  async getClassroomById(id: string): Promise<Classroom> {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: ['members', 'members.user'],
    });
    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }
    return classroom;
  }

  async updateTheme(id: string, theme: any): Promise<Classroom> {
    const classroom = await this.getClassroomById(id);
    if (
      theme &&
      typeof theme === 'object' &&
      (theme.activeTheme || Array.isArray(theme.customThemes))
    ) {
      classroom.theme = theme.activeTheme
        ? this.normalizeThemePatternIntensity(theme.activeTheme)
        : classroom.theme;
      classroom.customThemes = Array.isArray(theme.customThemes)
        ? theme.customThemes.map((item: any) =>
            this.normalizeThemePatternIntensity(item),
          )
        : classroom.customThemes;
    } else {
      classroom.theme = this.normalizeThemePatternIntensity(theme);
    }
    return this.classroomsRepository.save(classroom);
  }

  private normalizeThemePatternIntensity(theme: any): any {
    if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
      return theme;
    }

    const raw = Number(theme.patternIntensity);
    const normalized = Number.isFinite(raw)
      ? Math.max(0, Math.min(1, raw))
      : ClassroomsService.DEFAULT_PATTERN_INTENSITY;

    return {
      ...theme,
      patternIntensity: normalized,
    };
  }

  async updateFeatures(id: string, features: any): Promise<Classroom> {
    const classroom = await this.getClassroomById(id);
    classroom.featureToggles = features;
    return this.classroomsRepository.save(classroom);
  }

  async updateTelegramGroupId(
    id: string,
    telegramGroupId: string,
    user: User,
  ): Promise<Classroom> {
    const trimmed = (telegramGroupId || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Telegram group ID is required.');
    }

    const tgIdRegex = /^-?\d+$/;
    if (!tgIdRegex.test(trimmed)) {
      throw new BadRequestException('Invalid Telegram group ID format.');
    }

    const classroom = await this.getClassroomById(id);

    const existing = await this.classroomsRepository.findOne({
      where: { telegramGroupId: trimmed },
    });
    if (existing && existing.id !== id) {
      throw new BadRequestException(
        'Another classroom already uses this Telegram group ID.',
      );
    }

    const isMember = await this.checkGroupMembership(trimmed, user.telegramId);
    if (!isMember) {
      throw new ForbiddenException(
        'You are not a member of this Telegram group. Join the group first, then update the ID.',
      );
    }

    classroom.telegramGroupId = trimmed;
    return this.classroomsRepository.save(classroom);
  }

  async joinClassroom(
    inviteCode: string,
    user: User,
    providedTelegramGroupId?: string,
  ): Promise<{
    member: ClassroomMember;
    classroom: Classroom;
    user: User;
    accessToken: string;
  }> {
    let classroom: Classroom | null = null;
    let inviteEntity: InviteCode | null = null;

    // 1. Try to find a dynamic invite code from the admin module
    inviteEntity = await this.inviteCodeRepository.findOne({
      where: { code: inviteCode, isActive: true },
      relations: ['classroom'],
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
        throw new BadRequestException(
          'Invite code has reached its maximum uses',
        );
      }

      classroom = inviteEntity.classroom;
    } else {
      // 2. Fallback to default classroom invite code (permanent code)
      classroom = await this.classroomsRepository.findOne({
        where: { inviteCode, isActive: true },
      });
    }

    if (!classroom) {
      throw new BadRequestException('Invalid or inactive invite code');
    }

    if (
      providedTelegramGroupId &&
      providedTelegramGroupId.trim() !== classroom.telegramGroupId
    ) {
      throw new BadRequestException(
        'Telegram group ID does not match this invite code.',
      );
    }

    // 3. Verify membership in the Telegram group
    const isMember = await this.checkGroupMembership(
      classroom.telegramGroupId,
      user.telegramId,
    );
    if (!isMember) {
      throw new ForbiddenException(
        "You are not a member of this classroom's Telegram group. Please join the group first.",
      );
    }

    // 4. Check if user is already a member of the classroom
    const existingMember = await this.membersRepository.findOne({
      where: { classroom: { id: classroom.id }, user: { id: user.id } },
    });

    if (existingMember) {
      throw new BadRequestException('Already a member of this classroom');
    }

    const member = this.membersRepository.create({
      classroom,
      user,
      role: UserRole.STUDENT,
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
    const payload = { sub: user.id };
    const accessToken = this.jwtService.sign(payload);

    return {
      member: savedMember,
      classroom,
      user: this.toClassroomSafeUser(user, UserRole.STUDENT),
      accessToken,
    };
  }

  async getUserClassrooms(userId: string): Promise<{
    classrooms: Classroom[];
    memberships: {
      classroom: Classroom;
      role: UserRole;
      joinedAt: Date;
      status: ClassroomMemberStatus;
      suspendedUntil: Date | null;
    }[];
    user: User;
  }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const members = await this.membersRepository.find({
      where: { user: { id: userId } },
      relations: ['classroom'],
    });

    const now = new Date();
    const normalizedMembers: ClassroomMember[] = [];
    for (const member of members) {
      if (
        member.status === ClassroomMemberStatus.SUSPENDED &&
        member.suspendedUntil &&
        member.suspendedUntil <= now
      ) {
        member.status = ClassroomMemberStatus.ACTIVE;
        member.suspendedUntil = null;
        normalizedMembers.push(await this.membersRepository.save(member));
        continue;
      }
      normalizedMembers.push(member);
    }

    const accessibleMembers = normalizedMembers.filter((member) => {
      if (member.status === ClassroomMemberStatus.BANNED) return false;
      if (
        member.status === ClassroomMemberStatus.SUSPENDED &&
        (!member.suspendedUntil || member.suspendedUntil > now)
      ) {
        return false;
      }
      return true;
    });

    const classrooms = accessibleMembers.map((member) => member.classroom);
    const memberships = accessibleMembers.map((member) => ({
      classroom: member.classroom,
      role: member.role,
      joinedAt: member.joinedAt,
      status: member.status,
      suspendedUntil: member.suspendedUntil,
    }));
    return {
      classrooms,
      memberships,
      user: this.toClassroomSafeUser(user, UserRole.STUDENT),
    };
  }

  async getClassroomMembers(classroomId: string): Promise<ClassroomMember[]> {
    return this.membersRepository.find({
      where: { classroom: { id: classroomId } },
      relations: ['user'],
    });
  }

  async getClassroomMemberStats(classroomId: string) {
    const now = new Date();
    const raw = await this.membersRepository
      .createQueryBuilder('member')
      .where('member.classroomId = :classroomId', { classroomId })
      .select('COUNT(member.id)', 'totalMembers')
      .addSelect(
        `SUM(CASE WHEN member.status = :activeStatus OR (member.status = :suspendedStatus AND member.suspendedUntil IS NOT NULL AND member.suspendedUntil <= :now) THEN 1 ELSE 0 END)`,
        'activeMembers',
      )
      .addSelect(
        'SUM(CASE WHEN member.role = :adminRole THEN 1 ELSE 0 END)',
        'adminMembers',
      )
      .addSelect(
        'SUM(CASE WHEN member.status = :bannedStatus THEN 1 ELSE 0 END)',
        'bannedMembers',
      )
      .setParameters({
        now,
        adminRole: UserRole.ADMIN,
        activeStatus: ClassroomMemberStatus.ACTIVE,
        suspendedStatus: ClassroomMemberStatus.SUSPENDED,
        bannedStatus: ClassroomMemberStatus.BANNED,
      })
      .getRawOne<{
        totalMembers: string;
        activeMembers: string;
        adminMembers: string;
        bannedMembers: string;
      }>();

    return {
      totalMembers: Number(raw?.totalMembers || 0),
      activeMembers: Number(raw?.activeMembers || 0),
      adminMembers: Number(raw?.adminMembers || 0),
      bannedMembers: Number(raw?.bannedMembers || 0),
    };
  }

  async updateMemberStatus(
    classroomId: string,
    memberId: string,
    dto: { status: 'active' | 'suspended' | 'banned'; suspendedUntil?: Date },
  ): Promise<ClassroomMember> {
    const member = await this.membersRepository.findOne({
      where: { id: memberId, classroom: { id: classroomId } },
      relations: ['user'],
    });
    if (!member) throw new NotFoundException('Member not found');

    member.status = dto.status as ClassroomMemberStatus;
    member.suspendedUntil =
      dto.status === ClassroomMemberStatus.SUSPENDED
        ? dto.suspendedUntil || null
        : null;
    return this.membersRepository.save(member);
  }

  async updateMemberRole(
    classroomId: string,
    memberId: string,
    dto: { role: UserRole },
  ): Promise<ClassroomMember> {
    const member = await this.membersRepository.findOne({
      where: { id: memberId, classroom: { id: classroomId } },
      relations: ['user'],
    });
    if (!member) throw new NotFoundException('Member not found');

    // Update the role in this specific classroom
    member.role = dto.role;

    return this.membersRepository.save(member);
  }

  async removeMember(classroomId: string, memberId: string): Promise<void> {
    const member = await this.membersRepository.findOne({
      where: { id: memberId, classroom: { id: classroomId } },
      relations: ['user'],
    });
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
