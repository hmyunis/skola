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
    let botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!botToken) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not defined in configuration');
      return false;
    }

    // Clean the token (remove whitespace, quotes that might come from .env)
    botToken = botToken.trim().replace(/^["']|["']$/g, '');

    // Create a data check string by sorting keys alphabetically
    // We must use the raw values sent by Telegram.
    const dataCheckString = Object.keys(rest)
      .filter(key => rest[key as keyof typeof rest] !== undefined && rest[key as keyof typeof rest] !== null)
      .sort()
      .map((key) => `${key}=${rest[key as keyof typeof rest]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const isValid = computedHash === hash;

    if (!isValid) {
      this.logger.warn(`Telegram hash mismatch!`);
      this.logger.debug(`Data check string: [${dataCheckString.replace(/\n/g, '\\n')}]`);
      this.logger.debug(`Computed: ${computedHash}`);
      this.logger.debug(`Received: ${hash}`);
      this.logger.debug(`Token length: ${botToken.length}`);
    }

    return isValid;
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

    // Step B: Find or Create User
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
      
      // Save changes to the user object (e.g. photo URL or username updates)
      await this.usersService.update(user.id, { 
        photoUrl: user.photoUrl, 
        telegramUsername: user.telegramUsername 
      });
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
