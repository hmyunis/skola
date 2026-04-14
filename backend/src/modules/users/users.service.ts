import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User, UserRole } from './entities/user.entity';
import {
  ClassroomMember,
  ClassroomThemeSettings,
} from '../classrooms/entities/classroom-member.entity';
import { UpdateImageUploadSettingsDto } from './dto/update-image-upload-settings.dto';
import { UpdateAssistantSettingsDto } from './dto/update-assistant-settings.dto';
import { InAppNotification } from '../notifications/entities/in-app-notification.entity';

export interface UserImageUploadSettings {
  usePersonalApiKey: boolean;
  hasPersonalApiKey: boolean;
  keyHint: string | null;
}

export interface UserAssistantSettings {
  usePersonalApiKey: boolean;
  hasPersonalApiKey: boolean;
  keyHint: string | null;
  provider: 'gemini';
  model: string;
  resetPolicy: string;
}

interface AccountDeletionAdminCandidate {
  memberId: string;
  userId: string;
  name: string;
  telegramUsername: string | null;
}

export interface AccountDeletionContext {
  classroomId: string;
  classroomName: string;
  isOwner: boolean;
  adminCandidates: AccountDeletionAdminCandidate[];
}

@Injectable()
export class UsersService {
  private readonly byokEncryptionKey: Buffer;
  private readonly assistantModel = 'gemini-2.5-flash-lite';

  private toScopedProfilePayload(
    member: ClassroomMember,
  ): Record<string, unknown> {
    const user = member.user;
    return {
      id: user.id,
      name: user.name,
      initials: user.initials,
      role: member.role,
      telegramUsername: user.telegramUsername || null,
      photoUrl: user.photoUrl || null,
      anonymousId: user.anonymousId || null,
      code: user.code || null,
      year: user.year,
      semester: user.semester,
      batch: user.batch || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isBanned: false,
      suspendedUntil: null,
      themeSettings: member.themeSettings || null,
      notificationPreferences: member.notificationPreferences || null,
    };
  }

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(ClassroomMember)
    private classroomMembersRepository: Repository<ClassroomMember>,
    private configService: ConfigService,
  ) {
    this.byokEncryptionKey = this.deriveByokEncryptionKey();
  }

  async findByTelegramId(telegramId: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { telegramId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(userData: Partial<User>): Promise<User> {
    userData.anonymousId = userData.anonymousId || this.generateAnonymousId();

    // First user defaults to OWNER
    const count = await this.usersRepository.count();
    if (count === 0) {
      userData.role = UserRole.OWNER;
    }

    const newUser = this.usersRepository.create(userData);
    return this.usersRepository.save(newUser);
  }

  async update(id: string, data: Partial<User>): Promise<void> {
    await this.usersRepository.update(id, data);
  }

  async reviveDeletedAccount(
    userId: string,
    profile: {
      name: string;
      telegramUsername?: string | null;
      photoUrl?: string | null;
    },
  ): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.name = profile.name;
    user.telegramUsername = profile.telegramUsername || null;
    user.photoUrl = profile.photoUrl || null;
    user.deletedAt = null;
    if (!user.anonymousId) {
      user.anonymousId = this.generateAnonymousId();
    }

    return this.usersRepository.save(user);
  }

  async getScopedProfile(
    userId: string,
    classroomId: string,
  ): Promise<Record<string, unknown>> {
    const member = await this.classroomMembersRepository.findOne({
      where: { classroom: { id: classroomId }, user: { id: userId } },
      relations: ['user'],
    });
    if (!member?.user) {
      throw new NotFoundException('User not found in this classroom');
    }

    return this.toScopedProfilePayload(member);
  }

  async updateThemeSettings(
    userId: string,
    classroomId: string,
    themeSettings: ClassroomThemeSettings,
  ): Promise<Record<string, unknown>> {
    const member = await this.classroomMembersRepository.findOne({
      where: { classroom: { id: classroomId }, user: { id: userId } },
      relations: ['user'],
    });
    if (!member?.user) {
      throw new NotFoundException('User not found in this classroom');
    }

    member.themeSettings = {
      ...(member.themeSettings || {}),
      ...(themeSettings || {}),
    };
    await this.classroomMembersRepository.save(member);
    return this.getScopedProfile(userId, classroomId);
  }

  async deleteAccount(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async getAccountDeletionContext(
    userId: string,
    classroomId: string,
  ): Promise<AccountDeletionContext> {
    const membership = await this.classroomMembersRepository.findOne({
      where: {
        user: { id: userId },
        classroom: { id: classroomId },
      },
      relations: ['classroom'],
    });
    if (!membership?.classroom) {
      throw new NotFoundException(
        'Membership in this classroom was not found.',
      );
    }

    if (membership.role !== UserRole.OWNER) {
      return {
        classroomId: membership.classroom.id,
        classroomName: membership.classroom.name || 'Untitled classroom',
        isOwner: false,
        adminCandidates: [],
      };
    }

    const adminMembers = await this.classroomMembersRepository.find({
      where: {
        classroom: { id: classroomId },
        role: UserRole.ADMIN,
      },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
    const adminCandidates: AccountDeletionAdminCandidate[] = adminMembers
      .filter((member) => Boolean(member.user?.id))
      .map((member) => ({
        memberId: member.id,
        userId: member.user.id,
        name: member.user.name || 'Unknown',
        telegramUsername: member.user.telegramUsername || null,
      }));

    return {
      classroomId: membership.classroom.id,
      classroomName: membership.classroom.name || 'Untitled classroom',
      isOwner: true,
      adminCandidates,
    };
  }

  async deleteAccountInCurrentClassroom(
    userId: string,
    classroomId: string,
    successorMemberId?: string,
  ): Promise<void> {
    const normalizedSuccessorMemberId = (successorMemberId || '').trim();

    await this.classroomMembersRepository.manager.transaction(
      async (manager) => {
        const memberRepo = manager.getRepository(ClassroomMember);
        const notificationRepo = manager.getRepository(InAppNotification);

        const membership = await memberRepo.findOne({
          where: {
            classroom: { id: classroomId },
            user: { id: userId },
          },
          relations: ['classroom'],
        });
        if (!membership?.classroom) {
          throw new NotFoundException(
            'Membership in this classroom was not found.',
          );
        }

        const classroomName = membership.classroom.name || 'this classroom';
        if (membership.role === UserRole.OWNER) {
          const adminMembers = await memberRepo.find({
            where: {
              classroom: { id: classroomId },
              role: UserRole.ADMIN,
            },
            relations: ['user'],
            order: { joinedAt: 'ASC' },
          });

          if (!adminMembers.length) {
            throw new BadRequestException(
              `Promote an admin in ${classroomName} before leaving this classroom.`,
            );
          }

          if (!normalizedSuccessorMemberId) {
            throw new BadRequestException(
              `Choose an admin successor for ${classroomName} before leaving this classroom.`,
            );
          }

          const successorMembership = adminMembers.find(
            (adminMember) => adminMember.id === normalizedSuccessorMemberId,
          );
          if (!successorMembership?.user?.id) {
            throw new BadRequestException(
              `Selected successor for ${classroomName} is invalid.`,
            );
          }
          if (successorMembership.user.id === userId) {
            throw new BadRequestException(
              'Please choose a different admin as successor.',
            );
          }

          successorMembership.role = UserRole.OWNER;
          await memberRepo.save(successorMembership);
        }

        await notificationRepo
          .createQueryBuilder()
          .delete()
          .from(InAppNotification)
          .where('userId = :userId', { userId })
          .andWhere('classroomId = :classroomId', { classroomId })
          .execute();

        await memberRepo
          .createQueryBuilder()
          .delete()
          .from(ClassroomMember)
          .where('id = :membershipId', { membershipId: membership.id })
          .execute();
      },
    );
  }

  async getImageUploadSettings(
    userId: string,
    classroomId: string,
  ): Promise<UserImageUploadSettings> {
    const member = await this.findMemberWithSensitiveFields(
      userId,
      classroomId,
    );
    if (!member) {
      throw new NotFoundException('User not found in this classroom');
    }
    return this.toImageUploadSettings(member);
  }

  async updateImageUploadSettings(
    userId: string,
    classroomId: string,
    dto: UpdateImageUploadSettingsDto,
  ): Promise<UserImageUploadSettings> {
    const member = await this.findMemberWithSensitiveFields(
      userId,
      classroomId,
    );
    if (!member) {
      throw new NotFoundException('User not found in this classroom');
    }

    const requestedUsePersonal =
      dto.usePersonalApiKey === undefined
        ? member.usePersonalImgBbApiKey
        : dto.usePersonalApiKey;
    const normalizedApiKey = (dto.apiKey || '').trim();
    const shouldStoreNewApiKey = normalizedApiKey.length > 0;
    const shouldClearApiKey = Boolean(dto.clearApiKey);

    if (shouldStoreNewApiKey) {
      this.validateImgbbApiKey(normalizedApiKey);
      member.imgbbApiKeyCiphertext = this.encryptSecret(normalizedApiKey);
      member.imgbbApiKeyHint = this.maskKeyHint(normalizedApiKey);
    }

    if (shouldClearApiKey) {
      member.imgbbApiKeyCiphertext = null;
      member.imgbbApiKeyHint = null;
    }

    member.usePersonalImgBbApiKey = requestedUsePersonal;

    if (member.usePersonalImgBbApiKey && !member.imgbbApiKeyCiphertext) {
      throw new BadRequestException(
        'Personal image key mode is enabled, but no personal API key is saved.',
      );
    }

    await this.classroomMembersRepository.save(member);
    return this.toImageUploadSettings(member);
  }

  async getAssistantSettings(
    userId: string,
    classroomId: string,
  ): Promise<UserAssistantSettings> {
    const member = await this.findMemberWithSensitiveFields(
      userId,
      classroomId,
    );
    if (!member) {
      throw new NotFoundException('User not found in this classroom');
    }
    return this.toAssistantSettings(member);
  }

  async updateAssistantSettings(
    userId: string,
    classroomId: string,
    dto: UpdateAssistantSettingsDto,
  ): Promise<UserAssistantSettings> {
    const member = await this.findMemberWithSensitiveFields(
      userId,
      classroomId,
    );
    if (!member) {
      throw new NotFoundException('User not found in this classroom');
    }

    const requestedUsePersonal = true;
    const normalizedApiKey = (dto.apiKey || '').trim();
    const shouldStoreNewApiKey = normalizedApiKey.length > 0;
    const shouldClearApiKey = Boolean(dto.clearApiKey);

    if (shouldStoreNewApiKey) {
      this.validateOpenAIApiKey(normalizedApiKey);
      member.openAIApiKeyCiphertext = this.encryptSecret(normalizedApiKey);
      member.openAIApiKeyHint = this.maskKeyHint(normalizedApiKey);
    }

    if (shouldClearApiKey) {
      member.openAIApiKeyCiphertext = null;
      member.openAIApiKeyHint = null;
    }

    member.usePersonalOpenAIApiKey = requestedUsePersonal;

    if (
      member.usePersonalOpenAIApiKey &&
      !member.openAIApiKeyCiphertext &&
      !shouldClearApiKey
    ) {
      throw new BadRequestException(
        'Assistant BYOK mode is enabled, but no Gemini API key is saved.',
      );
    }

    await this.classroomMembersRepository.save(member);
    return this.toAssistantSettings(member);
  }

  async resolveAssistantApiKeyForUser(
    userId: string,
    classroomId: string,
  ): Promise<{
    usePersonalApiKey: boolean;
    personalApiKey: string | null;
  }> {
    const member = await this.findMemberWithSensitiveFields(
      userId,
      classroomId,
    );
    if (!member)
      throw new NotFoundException('User not found in this classroom');

    if (!member.openAIApiKeyCiphertext) {
      return { usePersonalApiKey: true, personalApiKey: null };
    }

    return {
      usePersonalApiKey: true,
      personalApiKey: this.decryptSecret(member.openAIApiKeyCiphertext),
    };
  }

  async resolveImgbbApiKeyForUser(
    userId: string,
    classroomId: string,
  ): Promise<{
    usePersonalApiKey: boolean;
    personalApiKey: string | null;
  }> {
    const member = await this.findMemberWithSensitiveFields(
      userId,
      classroomId,
    );
    if (!member)
      throw new NotFoundException('User not found in this classroom');

    if (!member.usePersonalImgBbApiKey) {
      return { usePersonalApiKey: false, personalApiKey: null };
    }
    if (!member.imgbbApiKeyCiphertext) {
      return { usePersonalApiKey: true, personalApiKey: null };
    }

    return {
      usePersonalApiKey: true,
      personalApiKey: this.decryptSecret(member.imgbbApiKeyCiphertext),
    };
  }

  private toImageUploadSettings(
    member: Pick<
      ClassroomMember,
      'usePersonalImgBbApiKey' | 'imgbbApiKeyCiphertext' | 'imgbbApiKeyHint'
    >,
  ): UserImageUploadSettings {
    return {
      usePersonalApiKey: Boolean(member.usePersonalImgBbApiKey),
      hasPersonalApiKey: Boolean(member.imgbbApiKeyCiphertext),
      keyHint: member.imgbbApiKeyHint || null,
    };
  }

  private toAssistantSettings(
    member: Pick<
      ClassroomMember,
      | 'usePersonalOpenAIApiKey'
      | 'openAIApiKeyCiphertext'
      | 'openAIApiKeyHint'
    >,
  ): UserAssistantSettings {
    return {
      usePersonalApiKey: true,
      hasPersonalApiKey: Boolean(member.openAIApiKeyCiphertext),
      keyHint: member.openAIApiKeyHint || null,
      provider: 'gemini',
      model: this.assistantModel,
      resetPolicy: 'Daily request quotas reset at midnight Pacific time.',
    };
  }

  private validateImgbbApiKey(apiKey: string) {
    if (apiKey.length < 16 || apiKey.length > 128) {
      throw new BadRequestException('Invalid API key length.');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
      throw new BadRequestException('API key contains invalid characters.');
    }
  }

  private validateOpenAIApiKey(apiKey: string) {
    if (apiKey.length < 20 || apiKey.length > 256) {
      throw new BadRequestException('Invalid API key length.');
    }
    if (/\s/.test(apiKey)) {
      throw new BadRequestException('API key contains invalid whitespace.');
    }
    if (!/^[!-~]+$/.test(apiKey)) {
      throw new BadRequestException('API key contains invalid characters.');
    }
  }

  private maskKeyHint(apiKey: string) {
    const suffix = apiKey.slice(-4);
    return `...${suffix}`;
  }

  private generateAnonymousId() {
    const randomHex = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0');
    return `Anon#${randomHex}`;
  }

  private deriveByokEncryptionKey(): Buffer {
    const secretSeed = (
      this.configService.get<string>('BYOK_ENCRYPTION_KEY') ||
      this.configService.get<string>('JWT_SECRET') ||
      ''
    ).trim();

    if (!secretSeed) {
      throw new InternalServerErrorException(
        'Missing BYOK encryption seed. Set BYOK_ENCRYPTION_KEY or JWT_SECRET.',
      );
    }

    return crypto.createHash('sha256').update(secretSeed).digest();
  }

  private encryptSecret(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      this.byokEncryptionKey,
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  private decryptSecret(payload: string): string {
    const parts = payload.split('.');
    if (parts.length !== 3) {
      throw new InternalServerErrorException(
        'Stored encrypted API key format is invalid.',
      );
    }

    try {
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const ciphertext = Buffer.from(parts[2], 'base64');
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.byokEncryptionKey,
        iv,
      );
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Unable to decrypt stored API key.',
      );
    }
  }

  private async findMemberWithSensitiveFields(
    userId: string,
    classroomId: string,
  ) {
    return this.classroomMembersRepository
      .createQueryBuilder('member')
      .innerJoin('member.user', 'user')
      .addSelect('member.imgbbApiKeyCiphertext')
      .addSelect('member.openAIApiKeyCiphertext')
      .where('user.id = :userId', { userId })
      .andWhere('member.classroomId = :classroomId', { classroomId })
      .getOne();
  }
}
