import { IsIn, IsOptional } from 'class-validator';
import type { NotificationTestType } from '../notifications.service';

export class SendTestNotificationDto {
  @IsOptional()
  @IsIn(['announcement', 'mention'])
  type?: NotificationTestType;
}
