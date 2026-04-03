import {
  Injectable,
  BadRequestException,
  ForbiddenException,
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

export interface UserImageUploadSettings {
  usePersonalApiKey: boolean;
  hasPersonalApiKey: boolean;
  keyHint: string | null;
}

@Injectable()
export class UsersService {
  private readonly byokEncryptionKey: Buffer;

  private toScopedProfilePayload(member: ClassroomMember): Record<string, unknown> {
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
    // Generate a unique anonymous ID
    const randomHex = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
    userData.anonymousId = `Anon#${randomHex}`;
    
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

  async deleteOwnerAccountWithSuccessor(
    ownerUserId: string,
    classroomId: string,
    successorMemberId: string,
  ): Promise<void> {
    const trimmedSuccessorMemberId = (successorMemberId || '').trim();
    if (!trimmedSuccessorMemberId) {
      throw new BadRequestException('Please choose an admin successor before deleting your account.');
    }

    await this.classroomMembersRepository.manager.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const memberRepo = manager.getRepository(ClassroomMember);

      const ownerMembership = await memberRepo.findOne({
        where: { classroom: { id: classroomId }, user: { id: ownerUserId } },
        relations: ['user'],
      });
      if (!ownerMembership) {
        throw new NotFoundException('Owner membership not found for this classroom.');
      }
      if (ownerMembership.role !== UserRole.OWNER) {
        throw new ForbiddenException('Only the current owner can transfer ownership and delete this account.');
      }

      const successorMembership = await memberRepo.findOne({
        where: { id: trimmedSuccessorMemberId, classroom: { id: classroomId } },
        relations: ['user'],
      });
      if (!successorMembership) {
        throw new NotFoundException('Selected successor was not found in this classroom.');
      }
      if (successorMembership.user.id === ownerUserId) {
        throw new BadRequestException('Please choose a different admin as successor.');
      }
      if (successorMembership.role !== UserRole.ADMIN) {
        throw new BadRequestException('Selected successor must currently be an admin.');
      }

      successorMembership.role = UserRole.OWNER;
      await memberRepo.save(successorMembership);

      await userRepo.delete(ownerUserId);
    });
  }

  async getImageUploadSettings(
    userId: string,
    classroomId: string,
  ): Promise<UserImageUploadSettings> {
    const member = await this.findMemberWithSensitiveFields(userId, classroomId);
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
    const member = await this.findMemberWithSensitiveFields(userId, classroomId);
    if (!member) {
      throw new NotFoundException('User not found in this classroom');
    }

    const requestedUsePersonal =
      dto.usePersonalApiKey === undefined ? member.usePersonalImgBbApiKey : dto.usePersonalApiKey;
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

  async resolveImgbbApiKeyForUser(userId: string, classroomId: string): Promise<{
    usePersonalApiKey: boolean;
    personalApiKey: string | null;
  }> {
    const member = await this.findMemberWithSensitiveFields(userId, classroomId);
    if (!member) throw new NotFoundException('User not found in this classroom');

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

  private validateImgbbApiKey(apiKey: string) {
    if (apiKey.length < 16 || apiKey.length > 128) {
      throw new BadRequestException('Invalid API key length.');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(apiKey)) {
      throw new BadRequestException('API key contains invalid characters.');
    }
  }

  private maskKeyHint(apiKey: string) {
    const suffix = apiKey.slice(-4);
    return `...${suffix}`;
  }

  private deriveByokEncryptionKey(): Buffer {
    const secretSeed = (
      this.configService.get<string>('BYOK_ENCRYPTION_KEY')
      || this.configService.get<string>('JWT_SECRET')
      || ''
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
    const cipher = crypto.createCipheriv('aes-256-gcm', this.byokEncryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  private decryptSecret(payload: string): string {
    const parts = payload.split('.');
    if (parts.length !== 3) {
      throw new InternalServerErrorException('Stored encrypted API key format is invalid.');
    }

    try {
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const ciphertext = Buffer.from(parts[2], 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.byokEncryptionKey, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      throw new InternalServerErrorException('Unable to decrypt stored API key.');
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
      .where('user.id = :userId', { userId })
      .andWhere('member.classroomId = :classroomId', { classroomId })
      .getOne();
  }
}
