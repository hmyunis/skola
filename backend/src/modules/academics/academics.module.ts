import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Semester } from './entities/semester.entity';
import { Course } from './entities/course.entity';
import { ScheduleItem } from './entities/schedule-item.entity';
import { Assessment } from './entities/assessment.entity';
import { AssessmentRating } from './entities/assessment-rating.entity';
import { CourseGroupFormation } from './entities/course-group-formation.entity';
import { CourseGroup } from './entities/course-group.entity';
import { CourseGroupMember } from './entities/course-group-member.entity';
import { AcademicsService } from './academics.service';
import { AcademicsController } from './academics.controller';
import { ClassroomsModule } from '../classrooms/classrooms.module';
import { ClassroomMember } from '../classrooms/entities/classroom-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Semester,
      Course,
      ScheduleItem,
      Assessment,
      AssessmentRating,
      CourseGroupFormation,
      CourseGroup,
      CourseGroupMember,
      ClassroomMember,
    ]),
    ClassroomsModule,
  ],
  controllers: [AcademicsController],
  providers: [AcademicsService],
  exports: [AcademicsService],
})
export class AcademicsModule {}
