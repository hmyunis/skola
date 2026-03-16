import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Announcement } from './entities/announcement.entity';
import { InviteCode } from './entities/invite-code.entity';
import { ClassroomsModule } from '../classrooms/classrooms.module';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';
import { Classroom } from '../classrooms/entities/classroom.entity';
import { LoungePost } from '../lounge/entities/lounge-post.entity';
import { Resource } from '../resources/entities/resource.entity';
import { Quiz } from '../arena/entities/quiz.entity';
import { QuizAttempt } from '../arena/entities/quiz-attempt.entity';
import { Course } from '../academics/entities/course.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      Announcement,
      InviteCode,
      ClassroomMember,
      Classroom,
      LoungePost,
      Resource,
      Quiz,
      QuizAttempt,
      Course,
    ]),
    ClassroomsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
