import {
  Body,
  Controller,
  Delete,
  Get,
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
import { ClassroomRoleGuard } from '../../core/guards/classroom-role.guard';
import { CurrentClassroom } from '../../core/decorators/current-classroom.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard, ClassroomRoleGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('settings')
  async getSettings(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
  ) {
    return this.notificationsService.getUserPreferences(user.id, classroomId);
  }

  @Put('settings')
  async updateSettings(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updateUserPreferences(
      user.id,
      classroomId,
      dto,
    );
  }

  @Get('in-app')
  async listInAppNotifications(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number.parseInt(limit || '', 10);
    return this.notificationsService.listInAppNotifications(
      user.id,
      classroomId,
      Number.isNaN(parsedLimit) ? undefined : parsedLimit,
    );
  }

  @Post('in-app/read-all')
  async markAllInAppNotificationsAsRead(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
  ) {
    return this.notificationsService.markAllInAppNotificationsAsRead(
      user.id,
      classroomId,
    );
  }

  @Post('in-app/:id/read')
  async markInAppNotificationAsRead(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markInAppNotificationAsRead(
      user.id,
      classroomId,
      id,
    );
  }

  @Delete('in-app/:id')
  async dismissInAppNotification(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.dismissInAppNotification(
      user.id,
      classroomId,
      id,
    );
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
    return this.notificationsService.removeWebPushSubscription(
      user.id,
      dto.endpoint,
    );
  }

  @Post('test')
  async sendTestNotification(
    @CurrentUser() user: User,
    @CurrentClassroom() classroomId: string,
    @Body() dto: SendTestNotificationDto,
  ) {
    return this.notificationsService.sendTestNotification(
      user.id,
      dto.type || 'announcement',
      classroomId,
    );
  }
}
