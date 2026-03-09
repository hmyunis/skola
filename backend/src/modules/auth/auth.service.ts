import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import { UsersService } from '../users/users.service';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private httpService: HttpService,
  ) {}

  // 1. Verify Telegram Hash
  private verifyTelegramHash(data: TelegramLoginDto): boolean {
    const { hash, ...rest } = data;
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      return false;
    }

    // Create a data check string by sorting keys alphabetically
    const dataCheckString = Object.keys(rest)
      .sort()
      .map((key) => `${key}=${(rest as any)[key]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return computedHash === hash;
  }

  // 2. Check Group Membership via Telegram API
  private async checkGroupMembership(userId: number): Promise<boolean> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const groupId = this.configService.get<string>('TELEGRAM_GROUP_ID');
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${groupId}&user_id=${userId}`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));
      const status = response.data.result.status;
      
      const allowedStatuses = ['creator', 'administrator', 'member', 'restricted'];
      return allowedStatuses.includes(status);
    } catch (error) {
      this.logger.error(`Failed to check group membership for user ${userId}`, error.message);
      return false; // Fail safe: deny access
    }
  }

  // 3. Main Login Flow
  async loginWithTelegram(dto: TelegramLoginDto) {
    // Step A: Validate Hash & Time
    if (!this.verifyTelegramHash(dto)) {
      throw new UnauthorizedException({ reason: 'unregistered', message: 'Invalid Telegram hash' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now - dto.auth_date > 300) { // 5 minutes expiry
      throw new UnauthorizedException({ reason: 'unregistered', message: 'Authentication payload expired' });
    }

    // Step B: Check Group Membership
    const isMember = await this.checkGroupMembership(dto.id);
    if (!isMember) {
      throw new ForbiddenException({ reason: 'not_in_group', message: 'You must join the class Telegram group to access SKOLA.' });
    }

    // Step C: Find or Create User
    let user = await this.usersService.findByTelegramId(dto.id);
    
    if (user) {
      // Check bans/suspensions
      if (user.isBanned) {
        throw new ForbiddenException({ reason: 'banned', message: 'Your account has been permanently banned.' });
      }
      if (user.suspendedUntil && new Date() < user.suspendedUntil) {
        throw new ForbiddenException({ 
          reason: 'suspended', 
          suspendedUntil: user.suspendedUntil,
          message: 'Your account is temporarily suspended.' 
        });
      }
      
      // Update info if it changed
      user.photoUrl = dto.photo_url || user.photoUrl;
      user.telegramUsername = dto.username || user.telegramUsername;
      // In a real app, you might want to call usersRepository.save(user) here
    } else {
      // Auto-register new user
      const name = dto.last_name ? `${dto.first_name} ${dto.last_name}` : dto.first_name;
      user = await this.usersService.create({
        telegramId: dto.id,
        name,
        telegramUsername: dto.username,
        photoUrl: dto.photo_url,
      });
    }

    // Step D: Generate JWT Token
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        initials: user.initials, // Using the virtual property
        role: user.role,
        telegramUsername: user.telegramUsername,
        photoUrl: user.photoUrl,
        anonymousId: user.anonymousId,
        year: user.year,
        semester: user.semester,
        batch: user.batch,
      },
    };
  }
}
