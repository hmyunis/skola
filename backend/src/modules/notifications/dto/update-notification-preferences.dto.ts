import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  inAppAnnouncements?: boolean;

  @IsOptional()
  @IsBoolean()
  browserPushAnnouncements?: boolean;

  @IsOptional()
  @IsBoolean()
  botDmAnnouncements?: boolean;
}
