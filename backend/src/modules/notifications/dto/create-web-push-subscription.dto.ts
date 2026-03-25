import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class WebPushSubscriptionKeysDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  p256dh: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  auth: string;
}

export class CreateWebPushSubscriptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  endpoint: string;

  @ValidateNested()
  @Type(() => WebPushSubscriptionKeysDto)
  keys: WebPushSubscriptionKeysDto;

  @IsOptional()
  @IsInt()
  expirationTime?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  userAgent?: string;
}
