import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Semester } from './entities/semester.entity';
import { Course } from './entities/course.entity';
import { ScheduleItem } from './entities/schedule-item.entity';
import { Assessment } from './entities/assessment.entity';
import { AssessmentRating } from './entities/assessment-rating.entity';
import { AcademicsService } from './academics.service';
import { AcademicsController } from './academics.controller';
import { ClassroomsModule } from '../classrooms/classrooms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Semester,
      Course,
      ScheduleItem,
      Assessment,
      AssessmentRating,
    ]),
    ClassroomsModule,
  ],
  controllers: [AcademicsController],
  providers: [AcademicsService],
  exports: [AcademicsService],
})
export class AcademicsModule {}
