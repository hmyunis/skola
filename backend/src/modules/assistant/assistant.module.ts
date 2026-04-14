import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { Course } from '../academics/entities/course.entity';
import { Assessment } from '../academics/entities/assessment.entity';
import { ScheduleItem } from '../academics/entities/schedule-item.entity';
import { Resource } from '../resources/entities/resource.entity';
import { Announcement } from '../admin/entities/announcement.entity';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { Quiz } from '../arena/entities/quiz.entity';

@Module({
  imports: [
    HttpModule,
    UsersModule,
    TypeOrmModule.forFeature([
      Course,
      Assessment,
      ScheduleItem,
      Resource,
      Announcement,
      ClassroomMember,
      Quiz,
    ]),
  ],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
