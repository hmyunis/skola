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
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { UpdateImageUploadSettingsDto } from './dto/update-image-upload-settings.dto';

export interface UserImageUploadSettings {
  usePersonalApiKey: boolean;
  hasPersonalApiKey: boolean;
  keyHint: string | null;
}

@Injectable()
export class UsersService {
  private readonly byokEncryptionKey: Buffer;

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

  async updateThemeSettings(userId: string, themeSettings: any): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    user.themeSettings = { ...user.themeSettings, ...themeSettings };
    return this.usersRepository.save(user);
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

      if (successorMembership.user.role !== UserRole.OWNER) {
        successorMembership.user.role = UserRole.OWNER;
        await userRepo.save(successorMembership.user);
      }

      await userRepo.delete(ownerUserId);
    });
  }

  async getImageUploadSettings(userId: string): Promise<UserImageUploadSettings> {
    const user = await this.findByIdWithSensitiveFields(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toImageUploadSettings(user);
  }

  async updateImageUploadSettings(
    userId: string,
    dto: UpdateImageUploadSettingsDto,
  ): Promise<UserImageUploadSettings> {
    const user = await this.findByIdWithSensitiveFields(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const requestedUsePersonal =
      dto.usePersonalApiKey === undefined ? user.usePersonalImgBbApiKey : dto.usePersonalApiKey;
    const normalizedApiKey = (dto.apiKey || '').trim();
    const shouldStoreNewApiKey = normalizedApiKey.length > 0;
    const shouldClearApiKey = Boolean(dto.clearApiKey);

    if (shouldStoreNewApiKey) {
      this.validateImgbbApiKey(normalizedApiKey);
      user.imgbbApiKeyCiphertext = this.encryptSecret(normalizedApiKey);
      user.imgbbApiKeyHint = this.maskKeyHint(normalizedApiKey);
    }

    if (shouldClearApiKey) {
      user.imgbbApiKeyCiphertext = null;
      user.imgbbApiKeyHint = null;
    }

    user.usePersonalImgBbApiKey = requestedUsePersonal;

    if (user.usePersonalImgBbApiKey && !user.imgbbApiKeyCiphertext) {
      throw new BadRequestException(
        'Personal image key mode is enabled, but no personal API key is saved.',
      );
    }

    await this.usersRepository.save(user);
    return this.toImageUploadSettings(user);
  }

  async resolveImgbbApiKeyForUser(userId: string): Promise<{
    usePersonalApiKey: boolean;
    personalApiKey: string | null;
  }> {
    const user = await this.findByIdWithSensitiveFields(userId);
    if (!user) throw new NotFoundException('User not found');

    if (!user.usePersonalImgBbApiKey) {
      return { usePersonalApiKey: false, personalApiKey: null };
    }
    if (!user.imgbbApiKeyCiphertext) {
      return { usePersonalApiKey: true, personalApiKey: null };
    }

    return {
      usePersonalApiKey: true,
      personalApiKey: this.decryptSecret(user.imgbbApiKeyCiphertext),
    };
  }

  private toImageUploadSettings(user: Pick<User, 'usePersonalImgBbApiKey' | 'imgbbApiKeyCiphertext' | 'imgbbApiKeyHint'>): UserImageUploadSettings {
    return {
      usePersonalApiKey: Boolean(user.usePersonalImgBbApiKey),
      hasPersonalApiKey: Boolean(user.imgbbApiKeyCiphertext),
      keyHint: user.imgbbApiKeyHint || null,
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

  private async findByIdWithSensitiveFields(userId: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.imgbbApiKeyCiphertext')
      .where('user.id = :userId', { userId })
      .getOne();
  }
}
