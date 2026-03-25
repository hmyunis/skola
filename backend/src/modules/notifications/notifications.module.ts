import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { User } from '../users/entities/user.entity';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { InAppNotification } from './entities/in-app-notification.entity';
import { WebPushSubscription } from './entities/web-push-subscription.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      User,
      ClassroomMember,
      InAppNotification,
      WebPushSubscription,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
