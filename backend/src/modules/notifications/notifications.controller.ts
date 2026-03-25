import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { CreateWebPushSubscriptionDto } from './dto/create-web-push-subscription.dto';
import { RemoveWebPushSubscriptionDto } from './dto/remove-web-push-subscription.dto';
import { SendTestNotificationDto } from './dto/send-test-notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('settings')
  async getSettings(@CurrentUser() user: User) {
    return this.notificationsService.getUserPreferences(user.id);
  }

  @Put('settings')
  async updateSettings(
    @CurrentUser() user: User,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updateUserPreferences(user.id, dto);
  }

  @Get('in-app')
  async listInAppNotifications(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number.parseInt(limit || '', 10);
    return this.notificationsService.listInAppNotifications(
      user.id,
      Number.isNaN(parsedLimit) ? undefined : parsedLimit,
    );
  }

  @Post('in-app/read-all')
  async markAllInAppNotificationsAsRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllInAppNotificationsAsRead(user.id);
  }

  @Post('in-app/:id/read')
  async markInAppNotificationAsRead(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markInAppNotificationAsRead(user.id, id);
  }

  @Delete('in-app/:id')
  async dismissInAppNotification(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.notificationsService.dismissInAppNotification(user.id, id);
  }

  @Get('push/config')
  async getWebPushConfig() {
    return this.notificationsService.getWebPushClientConfig();
  }

  @Post('push/subscribe')
  async subscribeWebPush(
    @CurrentUser() user: User,
    @Body() dto: CreateWebPushSubscriptionDto,
  ) {
    return this.notificationsService.saveWebPushSubscription(user.id, dto);
  }

  @Post('push/unsubscribe')
  async unsubscribeWebPush(
    @CurrentUser() user: User,
    @Body() dto: RemoveWebPushSubscriptionDto,
  ) {
    return this.notificationsService.removeWebPushSubscription(user.id, dto.endpoint);
  }

  @Post('test')
  async sendTestNotification(
    @CurrentUser() user: User,
    @Body() dto: SendTestNotificationDto,
    @Headers('x-classroom-id') classroomId?: string | string[],
  ) {
    return this.notificationsService.sendTestNotification(
      user.id,
      dto.type || 'announcement',
      typeof classroomId === 'string' ? classroomId : null,
    );
  }
}
